import { render, waitFor } from "@testing-library/react";
import { TaggingVotesChart } from "./tagging-votes-chart";

jest.mock("@gouvfr/dsfr-chart", () => ({}));

describe("TaggingVotesChart", () => {
  it("charts the total of votes for each week", async () => {
    const { container } = render(
      <TaggingVotesChart
        votesByWeek={[
          { weekStart: "2026-10-05", upvotes: 0, downvotes: 0 },
          { weekStart: "2026-10-12", upvotes: 3, downvotes: 2 },
        ]}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector("bar-chart")).not.toBeNull();
    });
    const chart = container.querySelector("bar-chart");
    expect(chart?.getAttribute("x")).toBe(
      '[["Sem. du 5 oct.","Sem. du 12 oct."]]',
    );
    expect(chart?.getAttribute("y")).toBe("[[0,5]]");
  });
});
