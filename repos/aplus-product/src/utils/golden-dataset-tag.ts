import { normalizeSearchQuery } from "@/utils/normalize";

export const TAG_MAX_LENGTH = 60;
/**
 * La consigne d'annotation dit « un à trois mots », mais les exemples fournis
 * la débordent : « Perte de carte d'identité » en fait quatre. Bloquer dessus
 * forcerait les annotateurs à contorsionner leurs libellés, ce qui dégraderait
 * le corpus. La borne dure est donc plus large que la norme affichée en aide de
 * saisie : elle n'écarte que les phrases.
 */
export const TAG_MAX_WORDS = 5;

export type AnnotationTagValidation =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export function validateAnnotationTag(
  raw: string | null | undefined,
): AnnotationTagValidation {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  if (trimmed.length > TAG_MAX_LENGTH) {
    return {
      ok: false,
      error: `Le tag ne doit pas dépasser ${TAG_MAX_LENGTH} caractères.`,
    };
  }

  const words = trimmed.split(/\s+/);
  if (words.length > TAG_MAX_WORDS) {
    return {
      ok: false,
      error: `Le tag doit rester court : ${TAG_MAX_WORDS} mots au maximum.`,
    };
  }

  return { ok: true, value: words.join(" ") };
}

/**
 * Un axe qu'aucune source ne permet de trancher reçoit ce texte plutôt qu'un
 * `null` : le corpus doit séparer « l'équipe a jugé le signalement
 * indéterminable » de « personne n'a encore tranché ».
 */
export const UNDETERMINED_GOLDEN_TAG = "inconnu";

export function canonicalTag(tag: string): string {
  return normalizeSearchQuery(tag.split(/\s+/).join(" "));
}

export function sameTag(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const canonical = canonicalTag(a);

  return canonical.length > 0 && canonical === canonicalTag(b);
}
