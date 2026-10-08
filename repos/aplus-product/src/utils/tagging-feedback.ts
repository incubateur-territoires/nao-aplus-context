import { displayedTaggingOf } from "@/utils/anonymized-report";
import { NO_BLOCKAGE_GOLDEN_TAG, sameTag } from "@/utils/golden-dataset-tag";
import type { StoredTags } from "@/utils/report-tagging";

export const TAGGING_AXES = {
  PROCEDURE: "procedure",
  BLOCKAGE: "blockage",
} as const;

export type TaggingAxis = (typeof TAGGING_AXES)[keyof typeof TAGGING_AXES];

/** La colonne de `ReportTaggingVerdict` qui porte le vote sur chaque axe. */
export const VERDICT_COLUMN_OF = {
  procedure: "procedureIsCorrect",
  blockage: "blockageIsCorrect",
} as const satisfies Record<TaggingAxis, string>;

export interface StoredVerdict {
  procedureIsCorrect: boolean | null;
  blockageIsCorrect: boolean | null;
}

export interface TaggingFeedbackAxis {
  axis: TaggingAxis;
  label: string;
  /** `null` : pas encore voté. */
  isCorrect: boolean | null;
}

/**
 * Les tags soumis à l'avis de l'utilisateur, dans l'ordre d'affichage.
 * « aucun » blocage n'est pas un tag à évaluer : l'axe est alors omis.
 */
export function taggingFeedbackAxesOf(
  tagging: Pick<StoredTags, "procedureLabel" | "blockageLabel">,
  verdict: StoredVerdict | null,
): TaggingFeedbackAxis[] {
  const { procedureLabel, blockageLabel } = displayedTaggingOf(tagging);
  const labels: [TaggingAxis, string | null][] = [
    [TAGGING_AXES.PROCEDURE, procedureLabel],
    [
      TAGGING_AXES.BLOCKAGE,
      sameTag(blockageLabel, NO_BLOCKAGE_GOLDEN_TAG) ? null : blockageLabel,
    ],
  ];

  return labels.flatMap(([axis, label]) =>
    label === null
      ? []
      : [
          {
            axis,
            label,
            isCorrect: verdict?.[VERDICT_COLUMN_OF[axis]] ?? null,
          },
        ],
  );
}
