import * as Sentry from "@sentry/nextjs";
import type { PrismaClient } from "@/generated/prisma/client";
import { classifyPipelineError } from "@/lib/ai/pipeline-error";
import { createLogger } from "@/utils/logger";
import { isPseudonymizationCronEnabled } from "@/utils/pseudonymized-report";
import {
  REPORT_CONTENT_WITH_PSEUDONYMIZED_SELECT,
  pseudonymizeMissingPieces,
  recordPseudonymizationRefusal,
} from "./pseudonymized-report";
import { PSEUDONYMIZATION_OUTCOMES } from "./report-pseudonymization";
import {
  TAGGING_REPORT_SELECT,
  tagReport,
  taggingRecipe,
} from "./report-tagging";

const logger = createLogger("Report Intake AI");

async function tagNewReport(
  prisma: PrismaClient,
  reportId: string,
): Promise<void> {
  const model = process.env.ALBERT_MODEL;
  if (!model) return;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: TAGGING_REPORT_SELECT,
  });
  const pseudonymized = report?.pseudonymized;
  if (!report || !pseudonymized) return;

  await tagReport(prisma, { ...report, pseudonymized }, taggingRecipe(model));
}

/**
 * Caviarde puis étiquette un signalement dès sa création. Les crons de nuit
 * restent le filet : une panne ici ne fait que leur laisser le dossier.
 */
export async function pseudonymizeAndTagNewReport(
  prisma: PrismaClient,
  reportId: string,
): Promise<void> {
  // L'interrupteur qui autorise l'envoi du texte à Albert vaut aussi ici.
  if (!isPseudonymizationCronEnabled()) return;

  try {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: REPORT_CONTENT_WITH_PSEUDONYMIZED_SELECT,
    });
    if (!report) return;

    const attempt = await pseudonymizeMissingPieces(prisma, reportId, report);
    if (attempt.outcome === PSEUDONYMIZATION_OUTCOMES.REFUSED) {
      await recordPseudonymizationRefusal(prisma, reportId, new Date());
      return;
    }
    if (attempt.outcome === PSEUDONYMIZATION_OUTCOMES.DONE) {
      await tagNewReport(prisma, reportId);
    }
  } catch (error) {
    // Panne ou refus du modèle : pas un bug, le cron d'étiquetage retentera.
    if (classifyPipelineError(error) !== null) {
      logger.info("Étiquetage à la création reporté au cron", { reportId });
      return;
    }
    logger.error("Erreur de caviardage ou d'étiquetage à la création", {
      reportId,
      error,
    });
    // Identifiant et erreur technique seulement, jamais un texte de signalement.
    Sentry.captureException(error, {
      fingerprint: ["report-intake-ai", "crash"],
      tags: { flow: "report-intake-ai" },
      extra: { reportId },
    });
  }
}
