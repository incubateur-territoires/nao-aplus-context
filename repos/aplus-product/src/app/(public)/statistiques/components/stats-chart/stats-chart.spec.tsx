import { render, screen, waitFor } from "@testing-library/react";
import { StatsChart } from "./stats-chart";

// Les web-components Vue/Chart.js ne peuvent pas s'évaluer sous jsdom :
// on mocke l'import à effet de bord.
jest.mock("@gouvfr/dsfr-chart", () => ({}));

describe("StatsChart", () => {
  it("affiche un état de chargement avant l'enregistrement du web-component", () => {
    render(<StatsChart type="pie" labels={["A", "B"]} values={[1, 2]} />);
    expect(screen.getByText("Chargement du graphique…")).toBeInTheDocument();
  });

  it("rend le tag pie-chart avec les données sérialisées", async () => {
    const { container } = render(
      <StatsChart type="pie" labels={["A", "B"]} values={[1, 2]} unit="%" />,
    );

    await waitFor(() => {
      expect(container.querySelector("pie-chart")).not.toBeNull();
    });

    const chart = container.querySelector("pie-chart");
    expect(chart?.getAttribute("x")).toBe('[["A","B"]]');
    expect(chart?.getAttribute("y")).toBe("[[1,2]]");
    expect(chart?.getAttribute("unit-tooltip")).toBe("%");
  });

  it("enveloppe le graphique dans .stats-chart (masquage de la légende intégrée)", async () => {
    const { container } = render(
      <StatsChart type="pie" labels={["A"]} values={[1]} />,
    );

    await waitFor(() => {
      expect(container.querySelector(".stats-chart pie-chart")).not.toBeNull();
    });
  });

  it("rend le tag bar-chart avec le nom de série", async () => {
    const { container } = render(
      <StatsChart
        type="bar"
        labels={["2025"]}
        values={[10]}
        seriesName="Signalements"
      />,
    );

    await waitFor(() => {
      expect(container.querySelector("bar-chart")).not.toBeNull();
    });

    const chart = container.querySelector("bar-chart");
    expect(chart?.getAttribute("name")).toBe('["Signalements"]');
  });
});
