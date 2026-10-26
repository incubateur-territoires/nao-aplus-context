import type {
  TaggingAxisStats,
  TaggingLabelStats,
  TaggingStats,
  WeeklyVotes,
} from "@/types/tagging-stats";
import {
  displayedTaggingOf,
  type DisplayedTagging,
} from "@/utils/anonymized-report";
import {
  TAGGING_AXES,
  taggingFeedbackAxesOf,
  type StoredVerdict,
  type TaggingAxis,
} from "@/utils/tagging-feedback";

export const VOTES_WEEKS_SHOWN = 12;

/**
 * Libellé de regroupement des signalements dont l'axe n'affiche rien aux
 * destinataires : le modèle s'est abstenu, a répondu par un exutoire
 * (« autre », « inconnu ») ou par un libellé absent de la taxonomie courante.
 */
export const NO_DISPLAYED_LABEL = "Sans libellé affiché";

const LABEL_COLUMN_OF = {
  procedure: "procedureLabel",
  blockage: "blockageLabel",
} as const satisfies Record<TaggingAxis, keyof DisplayedTagging>;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface VerdictForStats extends StoredVerdict {
  userId: string;
  createdAt: Date;
}

export interface TaggingWithVerdicts {
  reportId: string;
  createdAt: Date;
  procedureLabel: string | null;
  blockageLabel: string | null;
  verdicts: VerdictForStats[];
}

function approvalRateOf(upvotes: number, downvotes: number): number | null {
  const total = upvotes + downvotes;
  return total === 0 ? null : upvotes / total;
}

function mondayOf(date: Date): string {
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date.getTime() - daysSinceMonday * DAY_MS);
  return monday.toISOString().slice(0, 10);
}

function latestTaggingPerReport(
  taggings: TaggingWithVerdicts[],
): TaggingWithVerdicts[] {
  const latest = new Map<string, TaggingWithVerdicts>();
  for (const tagging of taggings) {
    const current = latest.get(tagging.reportId);
    if (!current || tagging.createdAt > current.createdAt) {
      latest.set(tagging.reportId, tagging);
    }
  }
  return [...latest.values()];
}

function emptyLabelStats(label: string): TaggingLabelStats {
  return { label, reports: 0, upvotes: 0, downvotes: 0, approvalRate: null };
}

/**
 * Les signalements se comptent sur leur dernier étiquetage, le seul que voient
 * les destinataires. Un vote reste attribué au libellé de l'étiquetage sur
 * lequel il a été émis, même si un étiquetage plus récent l'a remplacé depuis.
 * Les semaines sont celles du premier vote de la personne sur l'étiquetage.
 */
export function taggingStatsOf(
  taggings: TaggingWithVerdicts[],
  hiddenFeedbackUsers: number,
  now: Date = new Date(),
): TaggingStats {
  const axisList = Object.values(TAGGING_AXES);
  const labelsByAxis: Record<TaggingAxis, Map<string, TaggingLabelStats>> = {
    procedure: new Map(),
    blockage: new Map(),
  };
  function labelStats(axis: TaggingAxis, label: string): TaggingLabelStats {
    const labels = labelsByAxis[axis];
    let stats = labels.get(label);
    if (!stats) {
      stats = emptyLabelStats(label);
      labels.set(label, stats);
    }
    return stats;
  }

  const latest = latestTaggingPerReport(taggings);
  for (const tagging of latest) {
    const displayed = displayedTaggingOf(tagging);
    for (const axis of axisList) {
      const label = displayed[LABEL_COLUMN_OF[axis]] ?? NO_DISPLAYED_LABEL;
      labelStats(axis, label).reports += 1;
    }
  }

  const currentMonday = mondayOf(now);
  const votesByWeek: WeeklyVotes[] = Array.from(
    { length: VOTES_WEEKS_SHOWN },
    (_, index) => ({
      weekStart: mondayOf(
        new Date(
          Date.parse(currentMonday) -
            (VOTES_WEEKS_SHOWN - 1 - index) * 7 * DAY_MS,
        ),
      ),
      upvotes: 0,
      downvotes: 0,
    }),
  );
  const weekOf = new Map(votesByWeek.map((week) => [week.weekStart, week]));

  const voters = new Set<string>();
  let votes = 0;
  for (const tagging of taggings) {
    for (const verdict of tagging.verdicts) {
      for (const { axis, label, isCorrect } of taggingFeedbackAxesOf(
        tagging,
        verdict,
      )) {
        if (isCorrect === null) continue;
        const key = isCorrect ? "upvotes" : "downvotes";
        labelStats(axis, label)[key] += 1;
        const week = weekOf.get(mondayOf(verdict.createdAt));
        if (week) week[key] += 1;
        voters.add(verdict.userId);
        votes += 1;
      }
    }
  }

  function axisStats(axis: TaggingAxis): TaggingAxisStats {
    const labels = [...labelsByAxis[axis].values()]
      .map((stats) => ({
        ...stats,
        approvalRate: approvalRateOf(stats.upvotes, stats.downvotes),
      }))
      .sort(
        (a, b) => b.reports - a.reports || a.label.localeCompare(b.label, "fr"),
      );
    const upvotes = labels.reduce((sum, stats) => sum + stats.upvotes, 0);
    const downvotes = labels.reduce((sum, stats) => sum + stats.downvotes, 0);
    return {
      axis,
      labels,
      upvotes,
      downvotes,
      approvalRate: approvalRateOf(upvotes, downvotes),
    };
  }

  return {
    taggedReports: latest.length,
    voters: voters.size,
    votes,
    hiddenFeedbackUsers,
    axes: {
      procedure: axisStats(TAGGING_AXES.PROCEDURE),
      blockage: axisStats(TAGGING_AXES.BLOCKAGE),
    },
    votesByWeek,
  };
}

const REVIEW_MIN_VOTES = 5;
const REVIEW_MAX_APPROVAL = 0.5;

/** Assez de votes pour conclure, et une majorité qui désapprouve le libellé. */
export function needsReview(stats: TaggingLabelStats): boolean {
  return (
    stats.upvotes + stats.downvotes >= REVIEW_MIN_VOTES &&
    stats.approvalRate !== null &&
    stats.approvalRate < REVIEW_MAX_APPROVAL
  );
}

const CHART_LABEL_MAX_LENGTH = 30;

export function chartLabelOf(label: string): string {
  return label.length <= CHART_LABEL_MAX_LENGTH
    ? label
    : `${label.slice(0, CHART_LABEL_MAX_LENGTH - 1).trimEnd()}…`;
}
