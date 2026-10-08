import {
  PIPELINE_ERROR_KINDS,
  classifyPipelineError,
} from "@/lib/ai/pipeline-error";
import type { TokenCounters } from "@/lib/ai/pseudonymize";
import { redactReport } from "@/lib/ai/redact-report";
import type { PseudonymizedContent } from "@/types/pseudonymized-report";
import { createLogger } from "@/utils/logger";

/**
 * Pseudonymisation du texte libre d'un signalement, pour le conserver au lieu
 * de le remplacer par un faux texte à la suppression.
 *
 * Les trois issues sont distinctes parce que l'appelant en tire des décisions
 * opposées : DONE écrit le texte, REFUSED laisse le dossier en attente d'une
 * reprise, OUTAGE indique que le fournisseur est en panne et qu'il ne faut
 * surtout pas conclure à un refus — encore moins effacer quoi que ce soit.
 * Une exception qui n'est ni l'un ni l'autre est un bug : elle remonte.
 */

const logger = createLogger("Report Pseudonymization");

export const PSEUDONYMIZATION_OUTCOMES = {
  DONE: "DONE",
  REFUSED: "REFUSED",
  OUTAGE: "OUTAGE",
} as const;

export type PseudonymizationOutcome =
  (typeof PSEUDONYMIZATION_OUTCOMES)[keyof typeof PSEUDONYMIZATION_OUTCOMES];

/** Champs nécessaires au caviardage, y compris les noms connus en base. */
export const REPORT_CONTENT_SELECT = {
  subject: true,
  description: true,
  firstName: true,
  lastName: true,
  maritalName: true,
  birthDate: true,
  author: { select: { firstName: true, lastName: true } },
  answers: {
    select: {
      id: true,
      content: true,
      author: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

export interface ReportContent {
  subject: string;
  description: string;
  firstName: string;
  lastName: string;
  maritalName: string | null;
  birthDate: string;
  author: { firstName: string; lastName: string } | null;
  answers: {
    id: string;
    content: string;
    author: { firstName: string; lastName: string } | null;
  }[];
}

export type { PseudonymizedContent } from "@/types/pseudonymized-report";

/** Morceaux à caviarder quand d'autres le sont déjà ; les noms de tout le fil restent fournis. */
export interface RedactionScope {
  includeReport: boolean;
  answerIds: ReadonlySet<string>;
  tokenOffsets: TokenCounters;
}

export interface PseudonymizationAttempt {
  outcome: PseudonymizationOutcome;
  content?: PseudonymizedContent;
  /** Renseigné sur REFUSED et OUTAGE, pour les métriques et l'alerte. */
  reason?: string;
}

function fullName(person: { firstName: string; lastName: string } | null) {
  if (!person) return null;
  const name = `${person.firstName} ${person.lastName}`.trim();
  return name.length > 0 ? name : null;
}

/** Auteurs du signalement et des réponses : des noms connus, donc gratuits. */
function participantNames(report: ReportContent): string[] {
  const names = [
    fullName(report.author),
    ...report.answers.map((answer) => fullName(answer.author)),
  ];
  return [...new Set(names.filter((name): name is string => name !== null))];
}

export async function pseudonymizeReportContent(
  reportId: string,
  report: ReportContent,
  scope?: RedactionScope,
): Promise<PseudonymizationAttempt> {
  const includeReport = scope?.includeReport ?? true;
  const answers = scope
    ? report.answers.filter((answer) => scope.answerIds.has(answer.id))
    : report.answers;

  try {
    const result = await redactReport({
      subject: includeReport ? report.subject : "",
      description: includeReport ? report.description : "",
      answers: answers.map((answer) => ({
        id: answer.id,
        content: answer.content,
      })),
      tokenOffsets: scope?.tokenOffsets,
      identity: {
        firstName: report.firstName,
        lastName: report.lastName,
        maritalName: report.maritalName,
        birthDate: report.birthDate,
      },
      participantNames: participantNames(report),
    });

    if (!result.guard.ok) {
      // Les valeurs en cause ne sont jamais journalisées : ce sont des PII.
      const reason = `garde non satisfaite (${result.guard.violations.length} donnée(s) résiduelle(s))`;
      logger.info("Caviardage refusé", { reportId, reason });
      return { outcome: PSEUDONYMIZATION_OUTCOMES.REFUSED, reason };
    }

    return {
      outcome: PSEUDONYMIZATION_OUTCOMES.DONE,
      content: {
        subject: result.subject,
        description: result.description,
        answers: result.answers,
      },
    };
  } catch (error) {
    const kind = classifyPipelineError(error);
    if (kind === null) throw error;

    const reason = error instanceof Error ? error.message : String(error);
    if (kind === PIPELINE_ERROR_KINDS.REFUSED) {
      logger.info("Caviardage refusé par le fournisseur", { reportId, reason });
      return { outcome: PSEUDONYMIZATION_OUTCOMES.REFUSED, reason };
    }
    logger.error("Pipeline de caviardage indisponible", { reportId, reason });
    return { outcome: PSEUDONYMIZATION_OUTCOMES.OUTAGE, reason };
  }
}
