import { normalizeSearchQuery } from "@/utils/normalize";

/**
 * Vocabulaires contrôlés du tagage des signalements.
 *
 * Deux axes indépendants :
 *  - THEMES : le domaine administratif concerné ;
 *  - NATURES : le type de blocage rencontré.
 *
 * Le modèle ne peut tagger qu'avec ces libellés : la sortie LLM est filtrée
 * contre ces listes (cf. `matchTags`), ce qui garantit zéro tag halluciné et
 * une donnée exploitable pour le filtrage/analytics.
 *
 * Libellés volontairement atomiques (un concept, peu de ponctuation) pour un
 * matching robuste.
 */

export const THEMES = [
  "Santé",
  "Retraite",
  "Famille",
  "Logement",
  "Emploi",
  "Fiscalité",
  "État civil",
  "Immigration",
  "Handicap",
  "Justice",
  "Éducation",
  "Précarité",
] as const;

export const NATURES = [
  "Versement",
  "Transfert",
  "Déclaration",
  "Inscription",
  "Radiation",
  "Correction",
  "Accès au compte",
  "Retard",
  "Absence de réponse",
  "Justificatif manquant",
  "Trop-perçu",
] as const;

export type Theme = (typeof THEMES)[number];
export type Nature = (typeof NATURES)[number];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Retient les libellés du vocabulaire présents dans la sortie LLM, par
 * correspondance de mot insensible à la casse et aux accents. Indépendant du
 * format de réponse (virgules, lignes, prose). Garantit que seuls des libellés
 * valides ressortent (anti-hallucination).
 */
export function matchTags<T extends string>(
  output: string,
  vocabulary: readonly T[],
): T[] {
  const normalized = normalizeSearchQuery(output);
  return vocabulary.filter((label) => {
    const needle = escapeRegExp(normalizeSearchQuery(label));
    return new RegExp(`\\b${needle}\\b`).test(normalized);
  });
}
