import {
  chartLabelOf,
  needsReview,
  taggingStatsOf,
  type TaggingWithVerdicts,
} from "./tagging-stats";

const NOW = new Date("2026-10-15T12:00:00.000Z");

const TAGGINGS: TaggingWithVerdicts[] = [
  {
    reportId: "report-1",
    createdAt: new Date("2026-10-01T09:00:00.000Z"),
    procedureLabel: "demande rsa",
    blockageLabel: "dette",
    verdicts: [
      {
        userId: "user-1",
        createdAt: new Date("2026-10-02T09:00:00.000Z"),
        procedureIsCorrect: true,
        blockageIsCorrect: false,
      },
    ],
  },
  {
    reportId: "report-1",
    createdAt: new Date("2026-10-10T09:00:00.000Z"),
    procedureLabel: "demande carte vitale",
    blockageLabel: "Aucun",
    verdicts: [
      {
        userId: "user-2",
        createdAt: new Date("2026-10-13T09:00:00.000Z"),
        procedureIsCorrect: false,
        blockageIsCorrect: true,
      },
      {
        userId: "user-3",
        createdAt: new Date("2026-10-14T09:00:00.000Z"),
        procedureIsCorrect: null,
        blockageIsCorrect: null,
      },
    ],
  },
  {
    reportId: "report-2",
    createdAt: new Date("2026-10-05T09:00:00.000Z"),
    procedureLabel: "Demande RSA",
    blockageLabel: null,
    verdicts: [
      {
        userId: "user-1",
        createdAt: new Date("2026-10-06T09:00:00.000Z"),
        procedureIsCorrect: true,
        blockageIsCorrect: null,
      },
      {
        userId: "user-4",
        createdAt: new Date("2026-01-05T09:00:00.000Z"),
        procedureIsCorrect: true,
        blockageIsCorrect: null,
      },
    ],
  },
];

describe("taggingStatsOf", () => {
  const stats = taggingStatsOf(TAGGINGS, 7, NOW);

  it("counts each report once and ignores verdicts without a vote", () => {
    expect(stats.taggedReports).toBe(2);
    expect(stats.voters).toBe(3);
    expect(stats.votes).toBe(5);
    expect(stats.hiddenFeedbackUsers).toBe(7);
  });

  it("spreads reports over the labels of their latest tagging, votes over the tagging they judged", () => {
    expect(stats.axes.procedure).toEqual({
      axis: "procedure",
      labels: [
        {
          label: "demande carte vitale",
          reports: 1,
          upvotes: 0,
          downvotes: 1,
          approvalRate: 0,
        },
        {
          label: "demande rsa",
          reports: 1,
          upvotes: 3,
          downvotes: 0,
          approvalRate: 1,
        },
      ],
      upvotes: 3,
      downvotes: 1,
      approvalRate: 0.75,
    });
  });

  it("counts the « aucun » blockage without letting it collect votes", () => {
    expect(stats.axes.blockage).toEqual({
      axis: "blockage",
      labels: [
        {
          label: "aucun",
          reports: 1,
          upvotes: 0,
          downvotes: 0,
          approvalRate: null,
        },
        {
          label: "Sans libellé affiché",
          reports: 1,
          upvotes: 0,
          downvotes: 0,
          approvalRate: null,
        },
        {
          label: "dette",
          reports: 0,
          upvotes: 0,
          downvotes: 1,
          approvalRate: 0,
        },
      ],
      upvotes: 0,
      downvotes: 1,
      approvalRate: 0,
    });
  });

  it("buckets votes into the last twelve Monday-based weeks, empty ones included", () => {
    expect(stats.votesByWeek).toHaveLength(12);
    expect(stats.votesByWeek[0]).toEqual({
      weekStart: "2026-07-27",
      upvotes: 0,
      downvotes: 0,
    });
    expect(
      stats.votesByWeek.filter((week) => week.upvotes + week.downvotes > 0),
    ).toEqual([
      { weekStart: "2026-09-28", upvotes: 1, downvotes: 1 },
      { weekStart: "2026-10-05", upvotes: 1, downvotes: 0 },
      { weekStart: "2026-10-12", upvotes: 0, downvotes: 1 },
    ]);
  });

  it("returns empty axes and no rate without any tagging", () => {
    const empty = taggingStatsOf([], 0, NOW);

    expect(empty.taggedReports).toBe(0);
    expect(empty.votes).toBe(0);
    expect(empty.axes.procedure).toEqual({
      axis: "procedure",
      labels: [],
      upvotes: 0,
      downvotes: 0,
      approvalRate: null,
    });
  });
});

describe("needsReview", () => {
  function label(upvotes: number, downvotes: number) {
    const total = upvotes + downvotes;
    return {
      label: "demande rsa",
      reports: 3,
      upvotes,
      downvotes,
      approvalRate: total === 0 ? null : upvotes / total,
    };
  }

  it("flags a label disapproved by most of at least five votes", () => {
    expect(needsReview(label(2, 3))).toBe(true);
  });

  it("leaves alone a label with too few votes or a tied approval", () => {
    expect(needsReview(label(0, 4))).toBe(false);
    expect(needsReview(label(3, 3))).toBe(false);
    expect(needsReview(label(0, 0))).toBe(false);
  });
});

describe("chartLabelOf", () => {
  it("keeps a short label and truncates a long one to thirty characters", () => {
    expect(chartLabelOf("demande rsa")).toBe("demande rsa");
    expect(
      chartLabelOf("difficulté d'accès au service en ligne de l'organisme"),
    ).toBe("difficulté d'accès au service…");
  });
});
