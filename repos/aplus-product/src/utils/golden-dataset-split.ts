import { createHash } from "node:crypto";
import { allocate } from "@/utils/golden-dataset-strata";

/**
 * Découpage du corpus en « mise au point » (on itère la consigne dessus) et
 * « examen » (regardé une fois par consigne retenue). Le tirage est une fonction
 * pure de la recette et des items : rien n'est stocké, le code le fige.
 *
 * Changer la graine ou la taille, c'est un autre tirage : il faut une
 * `GOLDEN_SPLIT_V2`, jamais retoucher celle-ci, sinon des items déjà regardés
 * en mise au point passeraient à l'examen.
 */

export const GOLDEN_SPLITS = {
  TUNING: "tuning",
  TEST: "test",
} as const;

export type GoldenSplit = (typeof GOLDEN_SPLITS)[keyof typeof GOLDEN_SPLITS];

export const GOLDEN_SPLIT_ORDER: readonly GoldenSplit[] = [
  GOLDEN_SPLITS.TUNING,
  GOLDEN_SPLITS.TEST,
];

export interface GoldenSplitRecipe {
  readonly seed: string;
  readonly tuningSize: number;
}

export const GOLDEN_SPLIT_V1: GoldenSplitRecipe = {
  seed: "administration-plus/golden-dataset/split-v1",
  tuningSize: 30,
};

export interface SplittableItem {
  readonly id: string;
  readonly organization: string;
}

/** Une entrée par item : un item ne peut pas être dans les deux sous-ensembles. */
export type GoldenSplitAssignment = ReadonlyMap<string, GoldenSplit>;

function drawKey(seed: string, id: string): string {
  return createHash("sha256").update(`${seed}\n${id}`).digest("hex");
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Chaque item reçoit son sous-ensemble ; l'ordre de sortie n'a pas de sens. */
export function drawSplits<Item extends SplittableItem>(
  items: readonly Item[],
  recipe: GoldenSplitRecipe = GOLDEN_SPLIT_V1,
): (Item & { readonly split: GoldenSplit })[] {
  const byOrganization = new Map<string, Item[]>();
  for (const item of items) {
    const stratum = byOrganization.get(item.organization) ?? [];
    stratum.push(item);
    byOrganization.set(item.organization, stratum);
  }

  // Ordre des strates indépendant de l'ordre d'entrée : il départage les
  // plus forts restes égaux dans `allocate`.
  const strata = [...byOrganization.entries()]
    .map(([organization, members]) => ({
      organization,
      members: members
        .map((item) => ({ item, key: drawKey(recipe.seed, item.id) }))
        .sort((a, b) => compareText(a.key, b.key))
        .map(({ item }) => item),
    }))
    .sort(
      (a, b) =>
        b.members.length - a.members.length ||
        compareText(a.organization, b.organization),
    );

  const sizes = strata.map((stratum) => stratum.members.length);
  const takes = allocate(
    sizes,
    sizes,
    Math.min(recipe.tuningSize, items.length),
  );

  return strata.flatMap((stratum, index) =>
    stratum.members.map((item, rank) => ({
      ...item,
      split: rank < takes[index] ? GOLDEN_SPLITS.TUNING : GOLDEN_SPLITS.TEST,
    })),
  );
}

export function splitCorpus(
  items: readonly SplittableItem[],
  recipe: GoldenSplitRecipe = GOLDEN_SPLIT_V1,
): GoldenSplitAssignment {
  return new Map(
    drawSplits(items, recipe).map((item) => [item.id, item.split]),
  );
}

/**
 * Lecture stricte de `SPLIT` : sans valeur, la mise au point, jamais l'examen
 * par défaut ; toute autre valeur est refusée avant le moindre appel.
 */
export function parseSplitSelection(raw: string | undefined): GoldenSplit {
  if (raw === undefined) {
    return GOLDEN_SPLITS.TUNING;
  }

  const split = GOLDEN_SPLIT_ORDER.find((candidate) => candidate === raw);
  if (split === undefined) {
    throw new Error(
      `SPLIT « ${raw} » inconnu : « tuning » pour la mise au point (défaut), « test » pour l'examen.`,
    );
  }

  return split;
}
