import { render, screen } from "@testing-library/react";
import type { TaggingStats } from "@/types/tagging-stats";
import { TaggingDashboard } from "./tagging-dashboard";

jest.mock("@gouvfr/dsfr-chart", () => ({}));

function statsWith(taggedReports: number): TaggingStats {
  return {
    taggedReports,
    voters: 0,
    votes: 0,
    hiddenFeedbackUsers: 0,
    axes: {
      procedure: {
        axis: "procedure",
        labels: [],
        upvotes: 0,
        downvotes: 0,
        approvalRate: null,
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
}

describe("TaggingDashboard", () => {
  it("says so when nothing was tagged yet", () => {
    render(<TaggingDashboard stats={statsWith(0)} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Aucun signalement n'a encore été étiqueté par l'IA.",
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows one card per axis and the weekly votes", () => {
    render(<TaggingDashboard stats={statsWith(2)} />);

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      "Démarche du citoyen",
      "Blocage rencontré",
      "Votes par semaine",
    ]);
  });
});
