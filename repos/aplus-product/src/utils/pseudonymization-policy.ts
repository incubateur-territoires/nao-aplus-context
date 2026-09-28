/**
 * Décide si l'on renonce à pseudonymiser le texte d'un signalement masqué, et
 * si l'on doit alors le remplacer par un marqueur.
 *
 * La règle est isolée ici pour être exercée sans base ni réseau : elle gouverne
 * une destruction irréversible, et une condition inversée passerait inaperçue
 * dans le service.
 */

const DAYS_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Délai laissé au pipeline pour aboutir avant qu'on renonce. Trente tentatives
 * quotidiennes : ce qui échoue autant n'est pas un incident passager.
 */
export const PSEUDONYMIZATION_GRACE_DAYS = 30;

/**
 * Plafond d'effacements par exécution. Quel que soit l'incident, une nuit ne
 * peut pas vider le contenu de centaines de signalements.
 */
export const MAX_ERASURES_PER_RUN = 20;

/**
 * Échecs d'API consécutifs au-delà desquels on considère le fournisseur en
 * panne. On cesse alors de renoncer : une panne ne doit jamais consommer le
 * délai de grâce ni déclencher d'effacement.
 */
export const API_FAILURE_THRESHOLD = 3;

export interface ErasureDecision {
  /** Date de passage en DELETED, ou null si elle est introuvable. */
  maskedAt: Date | null;
  now: Date;
  /** Le fournisseur est considéré en panne sur cette exécution. */
  outage: boolean;
  /** Effacements déjà écrits pendant cette exécution. */
  erasedThisRun: number;
}

/**
 * Un texte n'est effacé que si le pipeline a réellement eu ses chances : jamais
 * pendant une panne, jamais au-delà du plafond, et seulement passé le délai.
 * Une date de masquage introuvable interdit l'effacement — sans elle, on ne
 * peut pas prouver que le délai est écoulé.
 */
export function shouldEraseContent(decision: ErasureDecision): boolean {
  if (decision.outage) return false;
  if (decision.erasedThisRun >= MAX_ERASURES_PER_RUN) return false;
  if (decision.maskedAt === null) return false;

  const deadline = new Date(
    decision.maskedAt.getTime() + PSEUDONYMIZATION_GRACE_DAYS * DAYS_IN_MS,
  );
  return decision.now >= deadline;
}

/** Le pipeline de pseudonymisation est-il activé sur cet environnement ? */
export function isPseudonymizationEnabled(): boolean {
  return process.env.REPORT_PSEUDONYMIZATION_ENABLED === "true";
}
