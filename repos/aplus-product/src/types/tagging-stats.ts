import type { TaggingAxis } from "@/utils/tagging-feedback";

export interface TaggingLabelStats {
  label: string;
  /** Signalements dont le dernier étiquetage affiche ce libellé. */
  reports: number;
  upvotes: number;
  downvotes: number;
  /** Part des votes favorables, entre 0 et 1 ; `null` sans aucun vote. */
  approvalRate: number | null;
}

export interface TaggingAxisStats {
  axis: TaggingAxis;
  /** Triés par nombre de signalements décroissant, puis par libellé. */
  labels: TaggingLabelStats[];
  upvotes: number;
  downvotes: number;
  approvalRate: number | null;
}

export interface WeeklyVotes {
  /** Lundi de la semaine (UTC), au format `AAAA-MM-JJ`. */
  weekStart: string;
  upvotes: number;
  downvotes: number;
}

export interface TaggingStats {
  taggedReports: number;
  voters: number;
  votes: number;
  hiddenFeedbackUsers: number;
  axes: Record<TaggingAxis, TaggingAxisStats>;
  /** Les dernières semaines, de la plus ancienne à la courante, vides comprises. */
  votesByWeek: WeeklyVotes[];
}
