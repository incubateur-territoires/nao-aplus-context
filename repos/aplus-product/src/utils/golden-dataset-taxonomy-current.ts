import {
  GOLDEN_TAXONOMY_V1,
  type TaxonomyV1Tags,
} from "@/utils/golden-dataset-taxonomy-v1";

/** Seul endroit à changer quand une v2 arrive : personne d'autre ne nomme une version. */
export const CURRENT_GOLDEN_TAXONOMY = GOLDEN_TAXONOMY_V1;
export type CurrentTaxonomyTags = TaxonomyV1Tags;
