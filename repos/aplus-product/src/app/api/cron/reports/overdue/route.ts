import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import prisma from "@/lib/prisma";
import { validateCronAuth } from "@/utils/cron-auth";
import { OrganizationRole, ReportStatus } from "@/generated/prisma/enums";
import {
  getOverdueBusinessDayCutoff,
  getOverdueCalendarDayCutoff,
} from "@/utils/business-days";
import { postToMattermost } from "@/app/services/mattermost.service";
import {
  buildNoOverdueReportsMessage,
  buildOverdueReportsMessage,
} from "@/app/services/mattermost-messages";
import {
  sendTemplatedEmailBatch,
  type EmailBatchOutcome,
} from "@/app/services/email/email-batch";
import { buildReportUrl } from "@/utils/report-url";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Overdue CRON");

const BUSINESS_DAYS_THRESHOLD = 3;
const CALENDAR_DAYS_THRESHOLD = 15;

interface OverdueReport {
  id: string;
  subject: string;
  author: {
    email: string;
    firstName: string;
    lastName: string;
    isInactive: Date | null;
  };
  coAuthors: {
    email: string;
    firstName: string;
    lastName: string;
  }[];
}

async function sendOverdueEmails(
  reports: OverdueReport[],
): Promise<EmailBatchOutcome> {
  const jobs = reports.flatMap((report) => {
    const authorRecipient =
      report.author.isInactive === null ? [report.author] : [];
    const recipients = Array.from(
      new Map(
        [...authorRecipient, ...report.coAuthors].map((u) => [u.email, u]),
      ).values(),
    );

    return recipients.map((recipient) => ({
      ref: report.id,
      to: [
        {
          email: recipient.email,
          name: `${recipient.firstName} ${recipient.lastName}`.trim(),
        },
      ],
      params: {
        userFirstName: recipient.firstName ?? "",
        reportSubject: report.subject,
        reportUrl: buildReportUrl(report.id),
      },
    }));
  });

  return sendTemplatedEmailBatch({
    template: "REPORT_OVERDUE",
    scope: "Overdue CRON",
    jobs,
  });
}

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request.headers.get("authorization"));
  if (authError) return authError;

  logger.info("Started");

  try {
    const now = new Date();
    const businessDayCutoff = getOverdueBusinessDayCutoff(
      now,
      BUSINESS_DAYS_THRESHOLD,
    );
    const calendarDayCutoff = getOverdueCalendarDayCutoff(
      now,
      CALENDAR_DAYS_THRESHOLD,
    );

    const activeStatus = {
      status: {
        in: [ReportStatus.PENDING_ASSIGNMENT, ReportStatus.IN_TREATMENT],
      },
      overdueAt: null,
    };

    // Les messages techniques (retrait ou désactivation d'un membre, invitation)
    // sont souvent signés par un opérateur mais ne répondent pas à l'aidant.
    const operatorAnswerFilter = {
      isMetadataOnly: false,
      author: { teams: { some: { role: OrganizationRole.OPERATOR } } },
    };

    const reportSelect = {
      id: true,
      subject: true,
      author: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          isInactive: true,
        },
      },
      coAuthors: {
        where: { isInactive: null },
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    } as const;

    // Case 1: no operator answer yet AND created more than 3 business days ago
    const pendingOldReports = await prisma.report.findMany({
      where: {
        ...activeStatus,
        createdAt: { lt: businessDayCutoff },
        answers: { none: operatorAnswerFilter },
      },
      select: reportSelect,
    });

    // Case 2: has an operator answer AND no message at all in the last 15 calendar days
    //
    // Le second filtre porte sur tout message non technique, et pas seulement sur
    // ceux des opérateurs : rouvrir un signalement (Traité/Clôturé → En cours de
    // traitement) crée un message et remet `overdueAt` à null. Sans
    // cela, la dernière réponse opérateur, antérieure à la clôture, ferait
    // repasser le signalement "en souffrance" dès le passage suivant du cron.
    // `lastAnswerAt` ne peut pas tenir ce rôle : les invitations, messages
    // techniques, le mettent aussi à jour.
    const staleAnsweredReports = await prisma.report.findMany({
      where: {
        ...activeStatus,
        answers: {
          some: operatorAnswerFilter,
          none: {
            isMetadataOnly: false,
            createdAt: { gte: calendarDayCutoff },
          },
        },
      },
      select: reportSelect,
    });

    // The two cases are mutually exclusive (no operator answer vs has operator answer),
    // but dedupe defensively in case the Prisma filter semantics ever change.
    const reportsById = new Map<string, OverdueReport>();
    for (const r of [...pendingOldReports, ...staleAnsweredReports]) {
      reportsById.set(r.id, r);
    }
    const reportsToUpdate = Array.from(reportsById.values());
    const checked = pendingOldReports.length + staleAnsweredReports.length;

    if (reportsToUpdate.length === 0) {
      await postToMattermost(buildNoOverdueReportsMessage());
      return NextResponse.json({
        message: "No reports to update",
        checked,
        updated: 0,
      });
    }

    const reportIds = reportsToUpdate.map((r) => r.id);

    await prisma.report.updateMany({
      where: { id: { in: reportIds } },
      data: { overdueAt: now },
    });

    logger.info('Signalements passés "En souffrance"', {
      updated: reportsToUpdate.length,
      reportIds,
    });

    after(async () => {
      const emails = await sendOverdueEmails(reportsToUpdate);
      try {
        await postToMattermost(
          buildOverdueReportsMessage(reportIds.length, emails),
        );
      } catch (mmError) {
        logger.error("Failed to post to Mattermost", { error: mmError });
      }
    });

    return NextResponse.json({
      message: "Reports updated successfully",
      checked,
      updated: reportsToUpdate.length,
      reportIds,
    });
  } catch (error) {
    logger.error("Error updating overdue reports", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
