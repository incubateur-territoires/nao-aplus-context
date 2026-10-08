import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ReportStatus } from "@/generated/prisma/enums";
import { mapWithConcurrency } from "@/utils/concurrency";
import {
  NEWEST_FIRST,
  nextCursor,
  olderThan,
  type NewestFirstCursor,
} from "@/utils/keyset-pagination";
import { createLogger } from "@/utils/logger";
import {
  createPipelineBudget,
  isExhausted,
  isOutage,
  recordOutcome,
  reserveCall,
  type PipelineBudget,
} from "@/utils/pipeline-budget";
import {
  PIPELINE_CALLS_PER_RUN,
  PSEUDONYMIZATION_REFUSAL_RETRY_DAYS,
  hasMissingPieces,
  isPseudonymizationCronEnabled,
  missingPieces,
} from "@/utils/pseudonymized-report";
import {
  REPORT_CONTENT_WITH_PSEUDONYMIZED_SELECT,
  pseudonymizeMissingPieces,
  recordPseudonymizationRefusal,
} from "./pseudonymized-report";
import { PSEUDONYMIZATION_OUTCOMES } from "./report-pseudonymization";

const logger = createLogger("Report Pseudonymization CRON");

const DAYS_IN_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;

/** Quatre dossiers de front : environ 50 requêtes/min sur les 100 permises. */
const CRON_CONCURRENCY = 4;

export interface ReportPseudonymizationRunResult {
  enabled: boolean;
  /** Signalements dont le sujet et la description viennent d'être pseudonymisés. */
  reportsPseudonymized: number;
  answersPseudonymized: number;
  refused: number;
  errors: { reportId: string; error: string }[];
  outage: boolean;
  callsUsed: number;
  callLimit: number;
  /** Relus en base en fin de run : ce qui reste à pseudonymiser, hors signalements supprimés. */
  reportsAwaiting: number;
  answersAwaiting: number;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emptyResult(
  enabled: boolean,
  callLimit: number,
): ReportPseudonymizationRunResult {
  return {
    enabled,
    reportsPseudonymized: 0,
    answersPseudonymized: 0,
    refused: 0,
    errors: [],
    outage: false,
    callsUsed: 0,
    callLimit,
    reportsAwaiting: 0,
    answersAwaiting: 0,
  };
}

/**
 * Sujets d'abord, puis réponses en attente. Les signalements supprimés
 * relèvent du cron de suppression.
 */
function candidatePhases(now: Date): Prisma.ReportWhereInput[] {
  const retryAfter = new Date(
    now.getTime() - PSEUDONYMIZATION_REFUSAL_RETRY_DAYS * DAYS_IN_MS,
  );
  const notRecentlyRefused: Prisma.ReportWhereInput = {
    NOT: { pseudonymizationRefusal: { is: { refusedAt: { gt: retryAfter } } } },
  };
  const notDeleted: Prisma.ReportWhereInput = {
    status: { not: ReportStatus.DELETED },
  };

  return [
    { ...notDeleted, ...notRecentlyRefused, pseudonymized: { is: null } },
    {
      ...notDeleted,
      ...notRecentlyRefused,
      pseudonymized: { isNot: null },
      answers: { some: { pseudonymized: { is: null } } },
    },
  ];
}

async function pseudonymizePhase(
  prisma: PrismaClient,
  where: Prisma.ReportWhereInput,
  budget: PipelineBudget,
  result: ReportPseudonymizationRunResult,
  now: Date,
): Promise<void> {
  let cursor: NewestFirstCursor | null = null;

  while (!isExhausted(budget)) {
    const page = await prisma.report.findMany({
      where: { AND: [where, olderThan(cursor)] },
      select: {
        id: true,
        createdAt: true,
        ...REPORT_CONTENT_WITH_PSEUDONYMIZED_SELECT,
      },
      orderBy: NEWEST_FIRST,
      take: BATCH_SIZE,
    });
    if (page.length === 0) return;
    cursor = nextCursor(page);

    await mapWithConcurrency(page, CRON_CONCURRENCY, async (report) => {
      const missing = missingPieces(report);
      if (!hasMissingPieces(missing) || !reserveCall(budget)) return;

      try {
        // Un seul appel pour tous les morceaux manquants du dossier : deux
        // appels coûteraient deux passes d'extraction et deux juges.
        const attempt = await pseudonymizeMissingPieces(
          prisma,
          report.id,
          report,
        );
        recordOutcome(
          budget,
          attempt.outcome === PSEUDONYMIZATION_OUTCOMES.OUTAGE,
        );

        if (attempt.outcome === PSEUDONYMIZATION_OUTCOMES.REFUSED) {
          result.refused += 1;
          await recordPseudonymizationRefusal(prisma, report.id, now);
          return;
        }
        if (attempt.outcome === PSEUDONYMIZATION_OUTCOMES.DONE) {
          if (missing.report) result.reportsPseudonymized += 1;
          result.answersPseudonymized += missing.answerIds.length;
        }
      } catch (error) {
        result.errors.push({ reportId: report.id, error: toMessage(error) });
        logger.error("Erreur de pseudonymisation", {
          reportId: report.id,
          error,
        });
      }
    });
  }
}

/**
 * Pseudonymise au fil de l'eau, sans jamais modifier le texte des
 * signalements. Un seul budget d'appels borne le run, disjoncteur compris.
 */
export async function processReportPseudonymization(
  prisma: PrismaClient,
  callLimit = PIPELINE_CALLS_PER_RUN,
): Promise<ReportPseudonymizationRunResult> {
  if (!isPseudonymizationCronEnabled()) {
    logger.info(
      "REPORT_PSEUDONYMIZATION_CRON_ENABLED n'est pas à « true » : rien à faire",
    );
    return emptyResult(false, callLimit);
  }

  const result = emptyResult(true, callLimit);
  const budget = createPipelineBudget(callLimit);
  const now = new Date();

  for (const where of candidatePhases(now)) {
    await pseudonymizePhase(prisma, where, budget, result, now);
  }

  result.outage = isOutage(budget);
  result.callsUsed = budget.used;
  result.reportsAwaiting = await prisma.report.count({
    where: {
      status: { not: ReportStatus.DELETED },
      pseudonymized: { is: null },
    },
  });
  result.answersAwaiting = await prisma.answer.count({
    where: {
      pseudonymized: { is: null },
      report: { status: { not: ReportStatus.DELETED } },
    },
  });
  return result;
}
