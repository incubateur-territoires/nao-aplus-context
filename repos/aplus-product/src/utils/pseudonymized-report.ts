import type {
  PseudonymizedContent,
  PseudonymizedPieces,
  StoredPseudonymizationSource,
} from "@/types/pseudonymized-report";

/**
 * Dossiers par run, à deux requêtes Albert au moins chacun. Avec l'étiquetage,
 * on reste sous les 50 000 requêtes/jour de gemma en production limitée.
 */
export const PIPELINE_CALLS_PER_RUN = 12_000;

/** Sans ce délai, les dossiers refusés resteraient en tête des candidats chaque nuit. */
export const PSEUDONYMIZATION_REFUSAL_RETRY_DAYS = 30;

export interface MissingPieces {
  report: boolean;
  answerIds: string[];
}

/** Chaque morceau se caviarde une fois : sujet, description et réponses sont immuables. */
export function missingPieces(
  source: StoredPseudonymizationSource,
): MissingPieces {
  return {
    report: source.pseudonymized == null,
    answerIds: source.answers
      .filter((answer) => answer.pseudonymized == null)
      .map((answer) => answer.id),
  };
}

export function hasMissingPieces(missing: MissingPieces): boolean {
  return missing.report || missing.answerIds.length > 0;
}

/** Textes déjà pseudonymisés, pour reprendre la numérotation des jetons après eux. */
export function storedPseudonymizedTexts(
  source: StoredPseudonymizationSource,
): string[] {
  return [
    ...(source.pseudonymized
      ? [source.pseudonymized.subject, source.pseudonymized.description]
      : []),
    ...source.answers.flatMap((answer) =>
      answer.pseudonymized ? [answer.pseudonymized.content] : [],
    ),
  ];
}

/**
 * Le dossier pseudonymisé en entier, morceaux stockés et morceaux obtenus à
 * l'instant, ou `null` s'il en manque un : il resterait du texte en clair.
 */
export function assemblePseudonymizedContent(
  source: StoredPseudonymizationSource,
  added: PseudonymizedPieces = { report: null, answers: [] },
): PseudonymizedContent | null {
  const report = source.pseudonymized ?? added.report;
  if (report == null) return null;

  const addedAnswers = new Map(
    added.answers.map((answer) => [answer.id, answer.content]),
  );
  const answers: PseudonymizedContent["answers"] = [];
  for (const answer of source.answers) {
    const content =
      answer.pseudonymized?.content ?? addedAnswers.get(answer.id);
    if (content === undefined) return null;
    answers.push({ id: answer.id, content });
  }

  return { subject: report.subject, description: report.description, answers };
}

/** Le cron de pseudonymisation au fil de l'eau est-il activé sur cet environnement ? */
export function isPseudonymizationCronEnabled(): boolean {
  return process.env.REPORT_PSEUDONYMIZATION_CRON_ENABLED === "true";
}

/** Ce qui reste dans `Report` et `Answer` une fois la copie pseudonymisée stockée : rien. */
export function clearedContent(
  content: PseudonymizedContent,
): PseudonymizedContent {
  return {
    subject: "",
    description: "",
    answers: content.answers.map((answer) => ({ id: answer.id, content: "" })),
  };
}
