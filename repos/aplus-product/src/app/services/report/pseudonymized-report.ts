import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { highestTokens } from "@/lib/ai/pseudonymize";
import type {
  PseudonymizedPieces,
  StoredPseudonymizationSource,
} from "@/types/pseudonymized-report";
import {
  assemblePseudonymizedContent,
  missingPieces,
  storedPseudonymizedTexts,
} from "@/utils/pseudonymized-report";
import {
  PSEUDONYMIZATION_OUTCOMES,
  REPORT_CONTENT_SELECT,
  pseudonymizeReportContent,
  type PseudonymizationAttempt,
  type ReportContent,
} from "./report-pseudonymization";

/** Le texte réel du dossier et ses morceaux déjà pseudonymisés. */
export const REPORT_CONTENT_WITH_PSEUDONYMIZED_SELECT = {
  ...REPORT_CONTENT_SELECT,
  pseudonymized: { select: { subject: true, description: true } },
  answers: {
    select: {
      ...REPORT_CONTENT_SELECT.answers.select,
      pseudonymized: { select: { content: true } },
    },
  },
} as const;

export interface ReportContentWithPseudonymized
  extends ReportContent, StoredPseudonymizationSource {
  answers: (ReportContent["answers"][number] & {
    pseudonymized?: { content: string } | null;
  })[];
}

/** Un long fil d'échanges dépasse le délai de transaction par défaut de Prisma (5 s). */
const TRANSACTION_OPTIONS = { timeout: 30_000 };

/** Morceaux jamais réécrits : en cas de course, le premier écrit reste. */
async function storePseudonymizedPieces(
  prisma: PrismaClient,
  reportId: string,
  pieces: PseudonymizedPieces,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (pieces.report) {
      await tx.pseudonymizedReport.createMany({
        data: [{ reportId, ...pieces.report }],
        skipDuplicates: true,
      });
    }
    if (pieces.answers.length > 0) {
      await tx.pseudonymizedAnswer.createMany({
        data: pieces.answers.map((answer) => ({
          answerId: answer.id,
          content: answer.content,
        })),
        skipDuplicates: true,
      });
    }
    await tx.reportPseudonymizationRefusal.deleteMany({ where: { reportId } });
  }, TRANSACTION_OPTIONS);
}

/** Le dossier ne sera retenté qu'après le délai de refus, par le cron comme à la création. */
export async function recordPseudonymizationRefusal(
  prisma: PrismaClient,
  reportId: string,
  refusedAt: Date,
): Promise<void> {
  await prisma.reportPseudonymizationRefusal.upsert({
    where: { reportId },
    create: { reportId, refusedAt },
    update: { refusedAt },
  });
}

/** Quand on renonce au texte d'un dossier, sa copie pseudonymisée ne lui survit pas. */
export async function discardPseudonymizedPieces(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<void> {
  await tx.pseudonymizedReport.deleteMany({ where: { reportId } });
  await tx.pseudonymizedAnswer.deleteMany({ where: { answer: { reportId } } });
}

/**
 * Caviarde en un appel les morceaux manquants, les stocke et rend sur DONE le
 * dossier complet. Les jetons reprennent après ceux déjà posés, sans collision.
 */
export async function pseudonymizeMissingPieces(
  prisma: PrismaClient,
  reportId: string,
  report: ReportContentWithPseudonymized,
): Promise<PseudonymizationAttempt> {
  const missing = missingPieces(report);
  const stored = storedPseudonymizedTexts(report);
  // Rien de stocké : le dossier entier part, comme avant le stockage.
  const attempt = await (stored.length === 0
    ? pseudonymizeReportContent(reportId, report)
    : pseudonymizeReportContent(reportId, report, {
        includeReport: missing.report,
        answerIds: new Set(missing.answerIds),
        tokenOffsets: highestTokens(stored),
      }));
  if (attempt.outcome !== PSEUDONYMIZATION_OUTCOMES.DONE || !attempt.content) {
    return attempt;
  }

  const pieces: PseudonymizedPieces = {
    report: missing.report
      ? {
          subject: attempt.content.subject,
          description: attempt.content.description,
        }
      : null,
    answers: attempt.content.answers,
  };
  await storePseudonymizedPieces(prisma, reportId, pieces);

  const content = assemblePseudonymizedContent(report, pieces);
  if (!content) {
    throw new Error("Dossier pseudonymisé incomplet après caviardage");
  }
  return { outcome: attempt.outcome, content };
}
