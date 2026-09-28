import { APICallError, RetryError } from "ai";
import { AlbertQuotaError } from "./providers";

/**
 * Classe une exception levée par le pipeline de caviardage, pour que l'appelant
 * n'y voie que trois cas : le fournisseur est en panne, le fournisseur a
 * examiné ce contenu et le refuse, ou c'est un bug de code qui doit remonter.
 *
 * Isolée ici parce que la distinction gouverne des décisions opposées : une
 * panne suspend le run sans rien conclure sur le dossier, un refus peut mener à
 * renoncer au texte, et un bug ne doit être confondu avec aucun des deux.
 */

export const PIPELINE_ERROR_KINDS = {
  OUTAGE: "OUTAGE",
  REFUSED: "REFUSED",
} as const;

export type PipelineErrorKind =
  (typeof PIPELINE_ERROR_KINDS)[keyof typeof PIPELINE_ERROR_KINDS];

/** Noms d'erreur que le SDK laisse passer tels quels sur interruption ou délai. */
const ABORT_ERROR_NAMES = new Set([
  "AbortError",
  "TimeoutError",
  "ResponseAborted",
]);

/** Message de `fetch` quand la connexion n'aboutit pas, avant tout statut HTTP. */
const FETCH_FAILED_MESSAGES = new Set(["fetch failed", "failed to fetch"]);

/**
 * Clé refusée ou modèle introuvable : la configuration est fausse, pas le
 * contenu. En refus, ils feraient renoncer au texte de tout le stock.
 */
const CONFIGURATION_STATUSES = new Set([401, 403, 404]);

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error || error instanceof DOMException) &&
    ABORT_ERROR_NAMES.has(error.name)
  );
}

function isFetchFailure(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    FETCH_FAILED_MESSAGES.has(error.message.toLowerCase())
  );
}

/** Un 4xx que le fournisseur a émis après avoir lu la requête, hors quota et configuration. */
function isContentRejection(statusCode: number | undefined): boolean {
  return (
    statusCode !== undefined &&
    statusCode >= 400 &&
    statusCode < 500 &&
    statusCode !== 429 &&
    !CONFIGURATION_STATUSES.has(statusCode)
  );
}

export function classifyPipelineError(
  error: unknown,
): PipelineErrorKind | null {
  // Le SDK réessaie puis enveloppe : seule la dernière erreur dit ce qui s'est passé.
  if (RetryError.isInstance(error)) {
    return classifyPipelineError(error.lastError);
  }
  if (error instanceof AlbertQuotaError) return PIPELINE_ERROR_KINDS.OUTAGE;

  if (APICallError.isInstance(error)) {
    return isContentRejection(error.statusCode)
      ? PIPELINE_ERROR_KINDS.REFUSED
      : PIPELINE_ERROR_KINDS.OUTAGE;
  }

  if (isAbortError(error) || isFetchFailure(error)) {
    return PIPELINE_ERROR_KINDS.OUTAGE;
  }

  return null;
}
