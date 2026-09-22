/**
 * Contrats partagés du pipeline IA de résumé des signalements.
 *
 * Le pipeline enchaîne des étapes déterministes : pseudonymisation → résumé
 * → tagage, avec des guardrails entre chaque. Seuls `subject` et `description`
 * d'un signalement transitent dans le pipeline (jamais les colonnes PII
 * structurées du modèle Report).
 */

/** Données d'entrée du pipeline : uniquement le texte libre du signalement. */
export interface PipelineInput {
  subject: string;
  description: string;
}

/**
 * Identité du citoyen issue de l'enregistrement Report. Sert UNIQUEMENT en
 * local à construire le dictionnaire de redaction des noms ; ces valeurs ne
 * sont jamais transmises à un LLM.
 */
export interface CitizenIdentity {
  firstName?: string | null;
  lastName?: string | null;
  maritalName?: string | null;
}

/**
 * Une étape du pipeline. Contrat uniforme pour que pseudonymisation, résumé
 * et tagage se branchent de la même façon dans l'orchestrateur.
 */
export interface Step<TIn, TOut> {
  /** Identifiant lisible, utilisé pour les logs et la progression UI. */
  readonly name: string;
  run(input: TIn): Promise<TOut>;
}

/**
 * Catégories de PII caviardées par la couche déterministe.
 * - NUMBER : toute suite longue de chiffres (NIR, NIF, CAF, téléphone, n° de
 *   dossier…). Les chiffres courts porteurs de sens (durée, montant, date)
 *   sont préservés.
 * - NAME : nom/prénom du citoyen, retiré via le dictionnaire de l'enregistrement.
 */
export const PII_TYPES = {
  NUMBER: "NUMBER",
  NAME: "NAME",
} as const;

export type PiiType = (typeof PII_TYPES)[keyof typeof PII_TYPES];

/** Une occurrence de PII détectée et son jeton de remplacement. */
export interface PiiMatch {
  type: PiiType;
  /** Valeur originale détectée (telle qu'écrite, séparateurs compris). */
  value: string;
  /** Jeton stable de substitution, ex. `[NUMERO_1]`. */
  placeholder: string;
}

/** Une PII résiduelle détectée dans une sortie LLM par un guardrail. */
export interface GuardViolation {
  type: PiiType;
  value: string;
}

/** Verdict d'un guardrail : `ok` si aucune violation. */
export interface GuardResult {
  ok: boolean;
  violations: GuardViolation[];
}

/** Résultat de la couche de pseudonymisation déterministe. */
export interface PseudonymizationResult {
  /** Texte caviardé, prêt à être envoyé à une étape LLM. */
  text: string;
  /**
   * Correspondances jeton → valeur originale. Conservé côté serveur pour
   * l'audit et les guardrails ; ne doit JAMAIS être transmis à un LLM.
   */
  matches: PiiMatch[];
}
