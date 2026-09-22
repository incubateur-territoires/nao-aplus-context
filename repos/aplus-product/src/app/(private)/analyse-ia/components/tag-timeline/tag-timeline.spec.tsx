import { render, screen } from "@testing-library/react";
import { buildTimeline, TagTimeline } from "./tag-timeline";

// Le web-component dsfr-chart (Vue + Chart.js) ne fonctionne pas sous jsdom :
// on vérifie les props transmises, pas le rendu du canvas.
jest.mock(
  "@/app/(public)/statistiques/components/stats-chart/stats-chart",
  () => ({
    StatsChart: (props: { labels: string[]; values: number[] }) => (
      <div
        data-testid="stats-chart"
        data-labels={props.labels.join("|")}
        data-values={props.values.join("|")}
      />
    ),
  }),
);

describe("buildTimeline", () => {
  it("groupe par mois de dépôt et comble les mois vides", () => {
    const timeline = buildTimeline([
      { createdAt: "2026-01-15T10:00:00.000Z" },
      { createdAt: "2026-01-20T10:00:00.000Z" },
      // février vide, doit apparaître à zéro
      { createdAt: "2026-03-02T10:00:00.000Z" },
    ]);

    expect(timeline.labels).toEqual(["janv. 2026", "févr. 2026", "mars 2026"]);
    expect(timeline.values).toEqual([2, 0, 1]);
    expect(timeline.undated).toBe(0);
  });

  it("compte à part les items sans date ou à date invalide", () => {
    const timeline = buildTimeline([
      { createdAt: "2026-01-15T10:00:00.000Z" },
      {},
      { createdAt: "n'importe quoi" },
    ]);

    expect(timeline.values).toEqual([1]);
    expect(timeline.undated).toBe(2);
  });

  it("reste vide sans aucun item daté", () => {
    expect(buildTimeline([{}])).toEqual({
      labels: [],
      values: [],
      undated: 1,
    });
  });
});

describe("TagTimeline", () => {
  it("ne rend rien sans item daté", () => {
    const { container } = render(
      <TagTimeline items={[{}]} isFiltered={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("passe la série mensuelle au graphique et signale les items sans date", () => {
    render(
      <TagTimeline
        items={[{ createdAt: "2026-01-15T10:00:00.000Z" }, {}]}
        isFiltered={true}
      />,
    );

    expect(
      screen.getByText("Évolution mensuelle (résultats filtrés)"),
    ).toBeInTheDocument();
    const chart = screen.getByTestId("stats-chart");
    expect(chart).toHaveAttribute("data-labels", "janv. 2026");
    expect(chart).toHaveAttribute("data-values", "1");
    expect(
      screen.getByText("1 signalement sans date", { exact: false }),
    ).toBeInTheDocument();
  });
});
