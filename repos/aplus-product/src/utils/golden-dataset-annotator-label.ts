import { normalizeSearchQuery } from "@/utils/normalize";

export interface NamedAnnotator {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Trois comptes admin partagent le prénom « Charles ». Une restitution qui
 * n'affiche que le prénom les confond en une seule personne : les annotations
 * de l'un s'attribuent à l'autre, et le corpus de référence devient faux.
 * Le nom n'est donc ajouté que là où il lève une ambiguïté, pour garder les
 * en-têtes courts partout ailleurs.
 */
export function buildAnnotatorLabels(
  annotators: NamedAnnotator[],
): Map<string, string> {
  const occurrences = new Map<string, number>();
  for (const annotator of annotators) {
    const key = normalizeSearchQuery(annotator.firstName);
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }

  return new Map(
    annotators.map((annotator) => {
      const isAmbiguous =
        (occurrences.get(normalizeSearchQuery(annotator.firstName)) ?? 0) > 1;
      const label = isAmbiguous
        ? `${annotator.firstName} ${annotator.lastName}`.trim()
        : annotator.firstName;

      return [annotator.id, label];
    }),
  );
}
