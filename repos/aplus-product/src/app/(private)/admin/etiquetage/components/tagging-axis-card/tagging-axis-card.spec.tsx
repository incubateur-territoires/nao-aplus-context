import { render, screen, waitFor, within } from "@testing-library/react";
import type { TaggingAxisStats } from "@/types/tagging-stats";
import { NO_DISPLAYED_LABEL } from "@/utils/tagging-stats";
import { TaggingAxisCard } from "./tagging-axis-card";

jest.mock("@gouvfr/dsfr-chart", () => ({}));

const STATS: TaggingAxisStats = {
  axis: "blockage",
  labels: [
    {
      label: NO_DISPLAYED_LABEL,
      reports: 500,
      upvotes: 0,
      downvotes: 0,
      approvalRate: null,
    },
    {
      label: "dette",
      reports: 12,
      upvotes: 1,
      downvotes: 4,
      approvalRate: 0.2,
    },
    {
      label: "détresse numérique",
      reports: 3,
      upvotes: 2,
      downvotes: 1,
      approvalRate: 2 / 3,
    },
    {
      label: "déménagement",
      reports: 0,
      upvotes: 0,
      downvotes: 0,
      approvalRate: null,
    },
  ],
  upvotes: 3,
  downvotes: 5,
  approvalRate: 0.375,
};

function rowTexts() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );
}

describe("TaggingAxisCard", () => {
  it("lists every label with its votes and flags the disapproved one", () => {
    render(<TaggingAxisCard title="Blocage rencontré" stats={STATS} />);

    expect(
      screen.getByRole("heading", { name: "Blocage rencontré" }),
    ).toBeInTheDocument();
    expect(rowTexts()).toEqual([
      ["Sans libellé affiché", "500", "0", "0", "–"],
      ["detteÀ revoir", "12", "1", "4", "20 %"],
      ["détresse numérique", "3", "2", "1", "66,7 %"],
      ["déménagement", "0", "0", "0", "–"],
    ]);
  });

  it("charts only displayed labels attributed to at least one report", async () => {
    const { container } = render(
      <TaggingAxisCard title="Blocage rencontré" stats={STATS} />,
    );

    await waitFor(() => {
      expect(container.querySelector("bar-chart")).not.toBeNull();
    });
    const chart = container.querySelector("bar-chart");
    expect(chart?.getAttribute("x")).toBe('[["dette","détresse numérique"]]');
    expect(chart?.getAttribute("y")).toBe("[[12,3]]");
  });
});
