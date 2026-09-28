import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import prisma from "@/lib/prisma";
import { validateCronAuth } from "@/utils/cron-auth";
import { createLogger } from "@/utils/logger";
import { processReportDeletion } from "@/app/services/report/report-deletion";
import { sendReportDeletionAlerts } from "@/app/services/report/report-deletion-alerts";
import { postToMattermost } from "@/app/services/mattermost.service";
import {
  buildDeletedReportsMessage,
  buildNoDeletedReportsMessage,
} from "@/app/services/mattermost-messages";

const logger = createLogger("Report Deletion CRON");

async function runReportDeletion() {
  try {
    logger.info("Started");
    const result = await processReportDeletion(prisma);

    logger.info("Processing complete", {
      reportsDeleted: result.reportsDeleted.length,
      pseudonymized: result.pseudonymized.length,
      awaitingPseudonymization: result.awaitingPseudonymization.length,
      awaitingPseudonymizationCount: result.awaitingPseudonymizationCount,
      contentErased: result.contentErased.length,
      pseudonymizationOutage: result.pseudonymizationOutage,
      skipped: result.skipped.length,
      fileErrors: result.fileErrors.length,
      errors: result.errors.length,
    });

    if (result.pseudonymizationOutage) {
      logger.error("Pipeline de caviardage indisponible sur ce run", {
        awaitingPseudonymizationCount: result.awaitingPseudonymizationCount,
      });
    }

    sendReportDeletionAlerts(result);

    // Une panne ou un stock en attente valent un message, même si aucun
    // signalement n'est arrivé à échéance : sans cela, une indisponibilité
    // passerait pour une nuit sans travail.
    const hasWork =
      result.reportsDeleted.length > 0 ||
      result.pseudonymized.length > 0 ||
      result.contentErased.length > 0 ||
      result.fileErrors.length > 0 ||
      result.errors.length > 0 ||
      result.pseudonymizationOutage ||
      result.awaitingPseudonymizationCount > 0;

    const message = hasWork
      ? buildDeletedReportsMessage(result)
      : buildNoDeletedReportsMessage();

    await postToMattermost(message);
  } catch (error) {
    logger.error("Error", { error });
    Sentry.captureException(error, {
      fingerprint: ["report-deletion", "crash"],
      tags: { cron: "reports/deletion" },
    });
  }
}

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request.headers.get("authorization"));
  if (authError) return authError;

  // Traitement en arrière-plan : suppression S3 + transactions peuvent être
  // longues, on répond immédiatement pour éviter le timeout du curl Scalingo.
  after(() => runReportDeletion());

  return NextResponse.json({ message: "Report deletion started" });
}
