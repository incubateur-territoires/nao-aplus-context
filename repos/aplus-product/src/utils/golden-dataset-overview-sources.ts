import {
  buildAnnotatorLabels,
  type NamedAnnotator,
} from "@/utils/golden-dataset-annotator-label";

export interface NamedRun {
  runId: string;
  model: string;
  temperature: number;
}

export interface OverviewSource {
  key: string;
  label: string;
  kind: "human" | "model";
}

/**
 * L'identifiant complet porte le préfixe de son éditeur, qui n'apprend rien de
 * plus et allonge d'autant la colonne des libellés.
 */
function shortenModelId(model: string): string {
  const separator = model.lastIndexOf("/");

  return separator === -1 ? model : model.slice(separator + 1);
}

/**
 * Même règle que `buildAnnotatorLabels`, appliquée à un autre axe : deux séries
 * du même modèle ne se distinguent que par leur température, comme deux
 * annotateurs homonymes ne se distinguent que par leur nom. La température n'est
 * donc ajoutée que là où elle lève une ambiguïté, pour garder les libellés
 * courts partout ailleurs.
 */
export function buildRunLabels(runs: NamedRun[]): Map<string, string> {
  const occurrences = new Map<string, number>();
  for (const run of runs) {
    const shortId = shortenModelId(run.model);
    occurrences.set(shortId, (occurrences.get(shortId) ?? 0) + 1);
  }

  return new Map(
    runs.map((run) => {
      const shortId = shortenModelId(run.model);
      const isAmbiguous = (occurrences.get(shortId) ?? 0) > 1;
      const temperature = String(run.temperature).replace(".", ",");
      const label = isAmbiguous
        ? `${shortId} (température ${temperature})`
        : shortId;

      return [run.runId, label];
    }),
  );
}

/**
 * Humains et modèles vivent dans deux tables sans lien entre elles. Leur seule
 * jointure est cette liste de sources, construite au rendu, les humaines
 * d'abord dans l'ordre rendu par le routeur puis les modèles. La clé d'une
 * source est son identifiant d'origine, ce qui suffit à retrouver ses tags sans
 * jamais tester de quelle sorte elle est.
 */
export function buildOverviewSources(
  annotators: NamedAnnotator[],
  runs: NamedRun[],
): OverviewSource[] {
  const annotatorLabels = buildAnnotatorLabels(annotators);
  const runLabels = buildRunLabels(runs);

  return [
    ...annotators.map((annotator): OverviewSource => {
      return {
        key: annotator.id,
        label: annotatorLabels.get(annotator.id) ?? annotator.firstName,
        kind: "human",
      };
    }),
    ...runs.map((run): OverviewSource => {
      return {
        key: run.runId,
        label: runLabels.get(run.runId) ?? run.model,
        kind: "model",
      };
    }),
  ];
}
