import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import prisma from "@/lib/prisma";
import { validateCronAuth } from "@/utils/cron-auth";
import { ReportStatus } from "@/generated/prisma/enums";
import {
  mergeEmailBatchOutcomes,
  sendTemplatedEmailBatch,
  type EmailBatchOutcome,
} from "@/app/services/email/email-batch";
import { buildReportUrl } from "@/utils/report-url";
import { CLOSED_REPORT_DATA } from "@/utils/report";
import { postToMattermost } from "@/app/services/mattermost.service";
import {
  buildAutoClosedReportsMessage,
  buildNoAutoClosedReportsMessage,
} from "@/app/services/mattermost-messages";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Auto Close CRON");

const DAYS_THRESHOLD = 30;
const BATCH_SIZE = 100;

interface ReportToClose {
  id: string;
  subject: string;
  author: {
    id: string;
    email: string;
    firstName: string;
  };
}

async function processAutoClose(reportsToClose: ReportToClose[]) {
  let totalClosed = 0;
  const allClosedIds: string[] = [];
  const emailOutcomes: EmailBatchOutcome[] = [];

  for (let i = 0; i < reportsToClose.length; i += BATCH_SIZE) {
    const batch = reportsToClose.slice(i, i + BATCH_SIZE);
    const batchIds = batch.map((r) => r.id);

    await prisma.$transaction(async (tx) => {
      await tx.report.updateMany({
        where: { id: { in: batchIds } },
        data: CLOSED_REPORT_DATA,
      });

      await tx.reportStatusHistory.createMany({
        data: batchIds.map((reportId) => ({
          reportId,
          status: ReportStatus.CLOSED,
        })),
      });
    });

    emailOutcomes.push(
      await sendTemplatedEmailBatch({
        template: "REPORT_AUTO_CLOSED",
        scope: "Auto Close CRON",
        jobs: batch.map((report) => ({
          ref: report.id,
          to: [{ email: report.author.email, name: report.author.firstName }],
          params: {
            userFirstName: report.author.firstName,
            reportSubject: report.subject,
            reportUrl: buildReportUrl(report.id),
          },
        })),
      }),
    );

    totalClosed += batch.length;
    allClosedIds.push(...batchIds);
  }

  const emails = mergeEmailBatchOutcomes(emailOutcomes);

  logger.info("Signalements automatiquement fermés", {
    closed: totalClosed,
    emailErrors: emails.failures.length,
  });

  try {
    await postToMattermost(buildAutoClosedReportsMessage(allClosedIds, emails));
  } catch (mmError) {
    logger.error("Failed to post to Mattermost", { error: mmError });
  }
}

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request.headers.get("authorization"));
  if (authError) return authError;

  logger.info("Started");

  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - DAYS_THRESHOLD);

    const completedReports = await prisma.report.findMany({
      where: {
        status: ReportStatus.COMPLETED,
        statusHistory: {
          some: {
            status: ReportStatus.COMPLETED,
            createdAt: {
              lte: thresholdDate,
            },
          },
        },
      },
      select: {
        id: true,
        subject: true,
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
        statusHistory: {
          where: {
            status: ReportStatus.COMPLETED,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            createdAt: true,
          },
        },
      },
    });

    const reportsToClose = completedReports.filter((report) => {
      const lastCompletedAt = report.statusHistory[0]?.createdAt;
      return lastCompletedAt && lastCompletedAt <= thresholdDate;
    });

    if (reportsToClose.length === 0) {
      await postToMattermost(buildNoAutoClosedReportsMessage());
      return NextResponse.json({
        message: "No reports to auto-close",
        checked: completedReports.length,
        closed: 0,
      });
    }

    // Process in background after response is sent
    after(() => processAutoClose(reportsToClose));

    return NextResponse.json({
      message: "Auto-close started",
      checked: completedReports.length,
      toClose: reportsToClose.length,
    });
  } catch (error) {
    logger.error("Error auto-closing reports", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
