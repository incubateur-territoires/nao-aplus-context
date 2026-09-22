import { sameTag } from "@/utils/golden-dataset-tag";

/**
 * Le label de référence retenu par l'équipe, un par axe. Ce sont les mêmes
 * clés que l'entrée de la mutation et que les colonnes de l'item, pour qu'un
 * clic se traduise en écriture sans table de correspondance intermédiaire.
 */
export interface GoldenTags {
  blockageTag: string | null;
  procedureTag: string | null;
}

export type GoldenTagAxis = keyof GoldenTags;

/**
 * L'ordre dans lequel les axes sont parcourus et restitués. Il existe pour que
 * les traitements bouclent dessus au lieu de nommer les deux axes à la main,
 * seule façon qu'un troisième axe soit pris en compte partout le jour où il
 * arrive.
 */
export const GOLDEN_TAG_AXES: GoldenTagAxis[] = ["blockageTag", "procedureTag"];

/**
 * Retenir un texte équivalent à celui déjà retenu le relâche ; retenir un autre
 * texte remplace le précédent. C'est le texte qui est retenu et non la source
 * qui l'a proposé, donc deux sources qui écrivent le même tag à la casse ou aux
 * accents près deviennent retenues ensemble.
 */
export function toggleGoldenTag(
  retained: GoldenTags,
  axis: GoldenTagAxis,
  tag: string,
): GoldenTags {
  return { ...retained, [axis]: sameTag(retained[axis], tag) ? null : tag };
}
