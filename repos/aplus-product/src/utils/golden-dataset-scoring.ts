import type { GoldenTagAxis } from "@/utils/golden-dataset-golden-tags";
import type { GoldenSplit } from "@/utils/golden-dataset-split";
import { sameTag, UNDETERMINED_GOLDEN_TAG } from "@/utils/golden-dataset-tag";
import {
  closedTagOfLabel,
  closedTagsOf,
  MIN_ITEMS_PER_TAG,
  type ClosedTaxonomy,
} from "@/utils/golden-dataset-taxonomy";

/**
 * Correction d'une série de prédictions contre le golden dataset. Module pur :
 * le script de correction charge les exports, ce module compte.
 *
 * Une prédiction `null` est une abstention : `parseGoldenTags` range
 * « inconnu » en `null`, on la relit donc comme le tag « inconnu ».
 */

/** Ce que la consigne de la série demandait au modèle. */
export type RunMode =
  /** Texte libre : le tag fermé est la projection du libellé, s'il est connu. */
  | { readonly kind: "free" }
  /** Liste fermée : la prédiction est le tag fermé, pas de score fin. */
  | { readonly kind: "closed" }
  /** Labels fins : le tag fermé se déduit du libellé par la projection. */
  | { readonly kind: "fine" };

export type RunModeKind = RunMode["kind"];

export const RUN_MODE_KINDS = ["free", "closed", "fine"] as const;

export type AxisTags = { readonly [A in GoldenTagAxis]: string | null };

export interface ScoringItem {
  readonly id: string;
  readonly split: GoldenSplit;
  /** Golds fins adjugés ; `null` quand personne n'a tranché. */
  readonly fineGolds: AxisTags;
  /** Golds fermés figés pour la version évaluée ; `null` avant le gel. */
  readonly closedGolds: AxisTags | null;
  /** Tags non vides des annotateurs, par axe. */
  readonly annotatorTags: { readonly [A in GoldenTagAxis]: readonly string[] };
}

export interface ScoringPrediction {
  readonly itemId: string;
  readonly blockageTag: string | null;
  readonly procedureTag: string | null;
}

export interface Proportion {
  readonly correct: number;
  readonly n: number;
  readonly rate: number;
  /** Intervalle de Wilson à 95 %. */
  readonly low: number;
  readonly high: number;
}

export type TagScore =
  | {
      readonly kind: "scored";
      readonly tag: string;
      readonly support: number;
      /** `null` quand le modèle n'a jamais prédit ce tag. */
      readonly precision: number | null;
      readonly recall: number;
      readonly f1: number;
    }
  | {
      readonly kind: "belowMinimum";
      readonly tag: string;
      readonly support: number;
    };

/** Prédiction fermée qui ne se range sous aucun tag de la liste. */
export const OFF_LIST = "hors liste";

export interface Confusion {
  readonly gold: string;
  /** Un tag de la liste, ou `OFF_LIST`. */
  readonly predicted: string;
  readonly count: number;
}

export interface Abstention {
  /** Items prédits sur l'axe. */
  readonly predicted: number;
  /** Prédictions « inconnu ». */
  readonly abstained: number;
  /** Items prédits dont le gold fin est « inconnu ». */
  readonly goldUndetermined: number;
  /** Abstentions tombées sur un gold « inconnu ». */
  readonly abstainedOnGoldUndetermined: number;
}

export interface AxisScores {
  /** Absent en liste fermée : le modèle n'y écrit pas de libellé fin. */
  readonly fine: {
    readonly strict: Proportion | null;
    /** Juste si la prédiction rejoint le gold ou au moins un annotateur. */
    readonly lenient: Proportion | null;
  } | null;
  readonly closed: {
    readonly strict: Proportion | null;
    readonly perTag: readonly TagScore[];
    /** Du plus fréquent au plus rare. */
    readonly confusions: readonly Confusion[];
  };
  readonly abstention: Abstention;
}

export interface SubsetScores {
  readonly items: number;
  /** Items ayant une prédiction : les autres ne comptent ni juste ni faux. */
  readonly predicted: number;
  readonly axes: { readonly [A in GoldenTagAxis]: AxisScores };
}

export type RunScores = { readonly [S in GoldenSplit]: SubsetScores };

const WILSON_Z = 1.96;

export function wilson(correct: number, n: number): Proportion | null {
  if (n === 0) {
    return null;
  }

  const rate = correct / n;
  const z2 = WILSON_Z * WILSON_Z;
  const center = rate + z2 / (2 * n);
  const margin =
    WILSON_Z * Math.sqrt((rate * (1 - rate)) / n + z2 / (4 * n * n));
  const denominator = 1 + z2 / n;

  return {
    correct,
    n,
    rate,
    low: Math.max(0, (center - margin) / denominator),
    high: Math.min(1, (center + margin) / denominator),
  };
}

function countRate(pairs: readonly boolean[]): Proportion | null {
  return wilson(pairs.filter(Boolean).length, pairs.length);
}

/** Le tag fermé que la prédiction désigne, ou `OFF_LIST`. */
function predictedClosedTag(
  mode: RunMode,
  taxonomy: ClosedTaxonomy,
  axis: GoldenTagAxis,
  label: string,
): string {
  if (mode.kind === "closed") {
    return (
      closedTagsOf(taxonomy, axis).find((tag) => sameTag(tag, label)) ??
      OFF_LIST
    );
  }

  return closedTagOfLabel(taxonomy, axis, label) ?? OFF_LIST;
}

interface Observation {
  readonly item: ScoringItem;
  /** Libellé prédit, « inconnu » pour une abstention. */
  readonly label: string;
  readonly closedTag: string;
}

function scoreTags(
  taxonomy: ClosedTaxonomy,
  axis: GoldenTagAxis,
  pairs: readonly { gold: string; predicted: string }[],
): TagScore[] {
  return closedTagsOf(taxonomy, axis).map((tag) => {
    const support = pairs.filter((pair) => pair.gold === tag).length;
    if (support < MIN_ITEMS_PER_TAG) {
      return { kind: "belowMinimum", tag, support };
    }

    const predictedCount = pairs.filter(
      (pair) => pair.predicted === tag,
    ).length;
    const truePositives = pairs.filter(
      (pair) => pair.gold === tag && pair.predicted === tag,
    ).length;
    const precision =
      predictedCount === 0 ? null : truePositives / predictedCount;
    const recall = truePositives / support;
    const f1 =
      precision === null || precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);

    return { kind: "scored", tag, support, precision, recall, f1 };
  });
}

function confusionsOf(
  pairs: readonly { gold: string; predicted: string }[],
): Confusion[] {
  const counts = new Map<string, Confusion>();
  for (const { gold, predicted } of pairs) {
    if (gold === predicted) {
      continue;
    }
    const key = `${gold}\u0000${predicted}`;
    const previous = counts.get(key);
    counts.set(key, { gold, predicted, count: (previous?.count ?? 0) + 1 });
  }

  return [...counts.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.gold.localeCompare(b.gold, "fr") ||
      a.predicted.localeCompare(b.predicted, "fr"),
  );
}

function isUndetermined(tag: string | null): boolean {
  return sameTag(tag, UNDETERMINED_GOLDEN_TAG);
}

function scoreAxis(
  observations: readonly Observation[],
  mode: RunMode,
  taxonomy: ClosedTaxonomy,
  axis: GoldenTagAxis,
): AxisScores {
  const fine =
    mode.kind === "closed"
      ? null
      : {
          strict: countRate(
            observations
              .filter(({ item }) => item.fineGolds[axis] !== null)
              .map(({ item, label }) => sameTag(label, item.fineGolds[axis])),
          ),
          lenient: countRate(
            observations
              .filter(
                ({ item }) =>
                  item.fineGolds[axis] !== null ||
                  item.annotatorTags[axis].length > 0,
              )
              .map(
                ({ item, label }) =>
                  sameTag(label, item.fineGolds[axis]) ||
                  item.annotatorTags[axis].some((tag) => sameTag(tag, label)),
              ),
          ),
        };

  const closedPairs = observations.flatMap(({ item, closedTag }) => {
    const gold = item.closedGolds?.[axis] ?? null;
    return gold === null ? [] : [{ gold, predicted: closedTag }];
  });

  const abstaining = observations.filter(({ label }) => isUndetermined(label));

  return {
    fine,
    closed: {
      strict: countRate(
        closedPairs.map(({ gold, predicted }) => gold === predicted),
      ),
      perTag: scoreTags(taxonomy, axis, closedPairs),
      confusions: confusionsOf(closedPairs),
    },
    abstention: {
      predicted: observations.length,
      abstained: abstaining.length,
      goldUndetermined: observations.filter(({ item }) =>
        isUndetermined(item.fineGolds[axis]),
      ).length,
      abstainedOnGoldUndetermined: abstaining.filter(({ item }) =>
        isUndetermined(item.fineGolds[axis]),
      ).length,
    },
  };
}

function scoreSubset(
  items: readonly ScoringItem[],
  predictions: ReadonlyMap<string, ScoringPrediction>,
  mode: RunMode,
  taxonomy: ClosedTaxonomy,
): SubsetScores {
  const predictedItems = items.flatMap((item) => {
    const prediction = predictions.get(item.id);
    return prediction === undefined ? [] : [{ item, prediction }];
  });

  function scoreOn(axis: GoldenTagAxis): AxisScores {
    const observations = predictedItems.map(({ item, prediction }) => {
      const label = prediction[axis] ?? UNDETERMINED_GOLDEN_TAG;
      return {
        item,
        label,
        closedTag: predictedClosedTag(mode, taxonomy, axis, label),
      };
    });
    return scoreAxis(observations, mode, taxonomy, axis);
  }

  return {
    items: items.length,
    predicted: predictedItems.length,
    axes: {
      blockageTag: scoreOn("blockageTag"),
      procedureTag: scoreOn("procedureTag"),
    },
  };
}

export function scoreRun(
  items: readonly ScoringItem[],
  predictions: readonly ScoringPrediction[],
  mode: RunMode,
  taxonomy: ClosedTaxonomy,
): RunScores {
  const byItem = new Map(
    predictions.map((prediction) => [prediction.itemId, prediction]),
  );

  function scoreOn(split: GoldenSplit): SubsetScores {
    return scoreSubset(
      items.filter((item) => item.split === split),
      byItem,
      mode,
      taxonomy,
    );
  }

  return { tuning: scoreOn("tuning"), test: scoreOn("test") };
}
