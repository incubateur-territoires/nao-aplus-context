import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import prisma from "@/lib/prisma";
import { validateCronAuth } from "@/utils/cron-auth";
import { createLogger } from "@/utils/logger";
import { processReportPseudonymization } from "@/app/services/report/report-pseudonymization-cron";
import { sendReportPseudonymizationAlerts } from "@/app/services/report/report-pseudonymization-cron-alerts";
import { postToMattermost } from "@/app/services/mattermost.service";
import { buildReportPseudonymizationMessage } from "@/app/services/mattermost-messages";

const logger = createLogger("Report Pseudonymization CRON");

async function runReportPseudonymization() {
  try {
    logger.info("Started");
    const result = await processReportPseudonymization(prisma);
    if (!result.enabled) return;

    logger.info("Processing complete", {
      reportsPseudonymized: result.reportsPseudonymized,
      answersPseudonymized: result.answersPseudonymized,
      refused: result.refused,
      errors: result.errors.length,
      outage: result.outage,
      callsUsed: result.callsUsed,
      reportsAwaiting: result.reportsAwaiting,
      answersAwaiting: result.answersAwaiting,
    });

    sendReportPseudonymizationAlerts(result);
    await postToMattermost(buildReportPseudonymizationMessage(result));
  } catch (error) {
    logger.error("Error", { error });
    Sentry.captureException(error, {
      fingerprint: ["report-pseudonymization", "crash"],
      tags: { cron: "reports/pseudonymization" },
    });
  }
}

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request.headers.get("authorization"));
  if (authError) return authError;

  // Plusieurs centaines d'appels au pipeline : on répond tout de suite.
  after(() => runReportPseudonymization());

  return NextResponse.json({ message: "Report pseudonymization started" });
}
