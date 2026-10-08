import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import prisma from "@/lib/prisma";
import { validateCronAuth } from "@/utils/cron-auth";
import { createLogger } from "@/utils/logger";
import { createPipelineBudget, isOutage } from "@/utils/pipeline-budget";
import {
  TAGGING_CALLS_PER_RUN,
  tagReports,
} from "@/app/services/report/report-tagging";
import { postToMattermost } from "@/app/services/mattermost.service";
import { buildReportTaggingMessage } from "@/app/services/mattermost-messages";

const logger = createLogger("Report Tagging");

async function runReportTagging() {
  try {
    logger.info("Started");
    const budget = createPipelineBudget(TAGGING_CALLS_PER_RUN);
    const result = await tagReports(prisma, budget, process.env.ALBERT_MODEL);
    const summary = {
      ...result,
      outage: isOutage(budget),
      callsUsed: budget.used,
      callLimit: TAGGING_CALLS_PER_RUN,
    };

    logger.info("Processing complete", {
      model: summary.model,
      tagged: summary.tagged,
      refused: summary.refused,
      errors: summary.errors.length,
      outage: summary.outage,
      callsUsed: summary.callsUsed,
    });

    if (summary.errors.length > 0) {
      // Identifiants et erreurs techniques seulement, jamais un texte de signalement.
      Sentry.captureMessage("Signalements non étiquetés", {
        level: "error",
        fingerprint: ["report-tagging", "errors"],
        tags: { cron: "reports/tagging", incident: "errors" },
        extra: { count: summary.errors.length, errors: summary.errors },
      });
    }
    await postToMattermost(buildReportTaggingMessage(summary));
  } catch (error) {
    logger.error("Error", { error });
    Sentry.captureException(error, {
      fingerprint: ["report-tagging", "crash"],
      tags: { cron: "reports/tagging" },
    });
  }
}

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request.headers.get("authorization"));
  if (authError) return authError;

  // Jusqu'à plusieurs milliers d'appels au pipeline : on répond tout de suite.
  after(() => runReportTagging());

  return NextResponse.json({ message: "Report tagging started" });
}
