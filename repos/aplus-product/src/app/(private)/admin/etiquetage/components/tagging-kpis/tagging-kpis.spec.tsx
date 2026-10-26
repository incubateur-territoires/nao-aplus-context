import { render, screen } from "@testing-library/react";
import type { TaggingStats } from "@/types/tagging-stats";
import { TaggingKpis } from "./tagging-kpis";

const STATS: TaggingStats = {
  taggedReports: 1234,
  voters: 12,
  votes: 40,
  hiddenFeedbackUsers: 3,
  axes: {
    procedure: {
      axis: "procedure",
      labels: [],
      upvotes: 30,
      downvotes: 10,
      approvalRate: 0.75,
    },
    blockage: {
      axis: "blockage",
      labels: [],
      upvotes: 0,
      downvotes: 0,
      approvalRate: null,
    },
  },
  votesByWeek: [],
};

function valueOf(label: string) {
  return screen.getByText(label).nextElementSibling?.textContent;
}

describe("TaggingKpis", () => {
  it("shows each figure under its label", () => {
    render(<TaggingKpis stats={STATS} />);

    expect(valueOf("Signalements étiquetés")).toBe("1\u202f234");
    expect(valueOf("Votants")).toBe("12");
    expect(valueOf("Votes")).toBe("40");
    expect(valueOf("Approbation de la démarche")).toBe("75 %");
    expect(valueOf("Approbation du blocage")).toBe("–");
    expect(valueOf("Utilisateurs ayant masqué le bloc de vote")).toBe("3");
  });
});
