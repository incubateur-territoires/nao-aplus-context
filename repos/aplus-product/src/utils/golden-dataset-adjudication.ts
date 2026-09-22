import {
  GOLDEN_TAG_AXES,
  type GoldenTagAxis,
} from "@/utils/golden-dataset-golden-tags";
import { sameTag } from "@/utils/golden-dataset-tag";

export const AXIS_VERDICTS = {
  UNANIMOUS: "unanimous",
  DIVERGENT: "divergent",
  SINGLE: "single",
  UNTAGGED: "untagged",
} as const;

export type AxisVerdict = (typeof AXIS_VERDICTS)[keyof typeof AXIS_VERDICTS];

export const ITEM_GROUPS = {
  ADJUDICATED: "adjudicated",
  UNANIMOUS: "unanimous",
  TO_DISCUSS: "toDiscuss",
} as const;

export type ItemGroup = (typeof ITEM_GROUPS)[keyof typeof ITEM_GROUPS];

/**
 * L'axe et la colonne qui porte son label retenu. Passer par cette table plutôt
 * que de tester l'axe à la main est ce qui permet aux traitements de boucler sur
 * `GOLDEN_TAG_AXES` sans jamais nommer un axe, jusqu'à la construction du `data`
 * envoyé à Prisma.
 */
export const GOLDEN_TAG_COLUMNS = {
  blockageTag: "goldenBlockageTag",
  procedureTag: "goldenProcedureTag",
} as const satisfies Record<GoldenTagAxis, string>;

export interface AdjudicationAnnotation {
  blockageTag: string | null;
  procedureTag: string | null;
}

export interface AdjudicationItem {
  goldenBlockageTag: string | null;
  goldenProcedureTag: string | null;
  annotations: AdjudicationAnnotation[];
}

export function axisTags(
  item: AdjudicationItem,
  axis: GoldenTagAxis,
): string[] {
  return item.annotations
    .map((annotation) => annotation[axis])
    .filter((tag): tag is string => tag !== null);
}

/**
 * `sameTag` compare deux formes canoniques, donc l'équivalence est transitive :
 * confronter chaque tag au premier suffit à établir que tous s'accordent.
 */
function allEquivalent(tags: string[]): boolean {
  return tags.every((tag) => sameTag(tag, tags[0]));
}

export function axisVerdict(tags: string[]): AxisVerdict {
  if (tags.length === 0) {
    return AXIS_VERDICTS.UNTAGGED;
  }

  if (tags.length === 1) {
    return AXIS_VERDICTS.SINGLE;
  }

  return allEquivalent(tags)
    ? AXIS_VERDICTS.UNANIMOUS
    : AXIS_VERDICTS.DIVERGENT;
}

/**
 * Le label qu'une unanimité désigne : la forme exacte la plus fréquente, la
 * première rencontrée l'emportant à égalité. Un tag isolé n'est pas une
 * unanimité et ne désigne donc rien.
 *
 * Le serveur et le client appellent tous deux cette fonction, pour que le
 * compte annoncé par le bouton et ce que la mutation écrit sortent du même
 * code. Une divergence entre les deux ferait mentir le bouton.
 */
export function unanimousChoice(tags: string[]): string | null {
  if (axisVerdict(tags) !== AXIS_VERDICTS.UNANIMOUS) {
    return null;
  }

  const occurrences = new Map<string, number>();
  for (const tag of tags) {
    occurrences.set(tag, (occurrences.get(tag) ?? 0) + 1);
  }

  let chosen: string | null = null;
  let chosenCount = 0;
  for (const [tag, count] of occurrences) {
    if (count > chosenCount) {
      chosen = tag;
      chosenCount = count;
    }
  }

  return chosen;
}

/**
 * Être tranché se dérive des colonnes retenues et ne se stocke jamais, dans la
 * philosophie déjà écrite sur les modèles `GoldenDataset*` : un champ stocké
 * pourrait mentir.
 */
export function itemGroup(item: AdjudicationItem): ItemGroup {
  const adjudicated = GOLDEN_TAG_AXES.every(
    (axis) => item[GOLDEN_TAG_COLUMNS[axis]] !== null,
  );
  if (adjudicated) {
    return ITEM_GROUPS.ADJUDICATED;
  }

  const unanimous = GOLDEN_TAG_AXES.every(
    (axis) => axisVerdict(axisTags(item, axis)) === AXIS_VERDICTS.UNANIMOUS,
  );

  return unanimous ? ITEM_GROUPS.UNANIMOUS : ITEM_GROUPS.TO_DISCUSS;
}

export interface AxisFill {
  axis: GoldenTagAxis;
  tag: string;
}

/**
 * Les axes qu'un remplissage automatique peut trancher sans rien écraser : un
 * axe déjà retenu à la main pendant la réunion en est exclu par construction.
 */
export function unanimousFills(item: AdjudicationItem): AxisFill[] {
  const fills: AxisFill[] = [];

  for (const axis of GOLDEN_TAG_AXES) {
    if (item[GOLDEN_TAG_COLUMNS[axis]] !== null) {
      continue;
    }

    const tag = unanimousChoice(axisTags(item, axis));
    if (tag !== null) {
      fills.push({ axis, tag });
    }
  }

  return fills;
}
