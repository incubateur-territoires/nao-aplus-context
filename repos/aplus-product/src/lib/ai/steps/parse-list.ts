/**
 * Parseur des listes renvoyées par Albert. Son déploiement vLLM ne supporte pas
 * le structured output : toutes les sorties sont du texte libre, et chaque étape
 * demande « des valeurs séparées par des virgules, ou AUCUN ».
 */

/** Réponse signalant qu'il n'y a rien à lister. */
const EMPTY_ANSWER = /^aucune?s?\.?$/i;

/** Jeton déjà posé, éventuellement imbriqué : jamais une valeur à traiter. */
const PLACEHOLDER = /\[+[A-Z_]+_\d+\]+/g;

/** Civilités citées autour d'un jeton : caviardées, elles videraient le texte. */
const CIVILITIES = new Set([
  "m",
  "mr",
  "mme",
  "mlle",
  "monsieur",
  "madame",
  "mademoiselle",
]);

/** Ce qui reste en clair autour des jetons, sans les civilités. */
function clearSegments(value: string): string[] {
  return value
    .split(PLACEHOLDER)
    .map((segment) => segment.trim().replace(/^[\s.,;:]+|[\s,;:]+$/g, ""))
    .filter(
      (segment) =>
        /[\p{L}\p{N}]/u.test(segment) &&
        !CIVILITIES.has(segment.replace(/\.$/, "").toLocaleLowerCase()),
    );
}

export function parseLlmList(text: string): string[] {
  const trimmed = text.trim();
  if (EMPTY_ANSWER.test(trimmed)) return [];

  const seen = new Set<string>();
  const values: string[] = [];

  for (const raw of trimmed.split(/[,\n]/)) {
    const value = raw
      .trim()
      .replace(/^[-•*\s]+/, "")
      .replace(/^["«»']|["«»']$/g, "")
      .trim();
    for (const segment of clearSegments(value)) {
      const key = segment.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(segment);
    }
  }

  return values;
}
