import type { GoldenTagAxis } from "@/utils/golden-dataset-golden-tags";
import { UNDETERMINED_GOLDEN_TAG } from "@/utils/golden-dataset-tag";
import { closedTagOfLabel } from "@/utils/golden-dataset-taxonomy";
import { CURRENT_GOLDEN_TAXONOMY } from "@/utils/golden-dataset-taxonomy-current";

/** Même forme que la colonne `organization` du golden dataset : le sigle de l'organisme. */
export function organizationLabel(shortNames: string[]): string {
  return [...new Set(shortNames)].sort().join(", ");
}

export interface TaggingRecipeIdentity {
  model: string;
  promptHash: string;
  temperature: number;
  taxonomyVersion: number;
}

/** Trace la recette (modèle, consigne, température, liste) qui a produit un étiquetage. */
export function reportTaggingRecipeKey(recipe: TaggingRecipeIdentity): string {
  return [
    recipe.model,
    recipe.promptHash,
    `t${recipe.temperature}`,
    `v${recipe.taxonomyVersion}`,
  ].join(":");
}

export interface PredictedLabels {
  procedureTag: string | null;
  blockageTag: string | null;
}

export interface StoredTags {
  procedureLabel: string | null;
  procedureTag: string | null;
  blockageLabel: string | null;
  blockageTag: string | null;
}

/**
 * Libellé fin conservé tel quel, tag fermé projeté comme à l'examen. Une
 * abstention se range en « inconnu », un libellé hors liste en `null`.
 */
export function storedTags(labels: PredictedLabels): StoredTags {
  return {
    procedureLabel: labels.procedureTag,
    procedureTag: closedTag("procedureTag", labels.procedureTag),
    blockageLabel: labels.blockageTag,
    blockageTag: closedTag("blockageTag", labels.blockageTag),
  };
}

function closedTag(axis: GoldenTagAxis, label: string | null): string | null {
  return closedTagOfLabel(
    CURRENT_GOLDEN_TAXONOMY,
    axis,
    label ?? UNDETERMINED_GOLDEN_TAG,
  );
}
