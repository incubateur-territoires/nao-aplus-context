/**
 * Échappe les métacaractères d'une chaîne destinée à être injectée dans une
 * RegExp, pour qu'elle y soit traitée comme du texte littéral.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
