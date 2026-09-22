import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatCard } from "./stat-card";
import { exportStatsXlsx } from "@/utils/export-stats-xlsx";
import { captureStatChart } from "@/utils/capture-stat-chart";

jest.mock("@/utils/export-stats-xlsx", () => ({
  exportStatsXlsx: jest.fn(),
}));

jest.mock("@/utils/capture-stat-chart", () => ({
  captureStatChart: jest.fn(),
}));

jest.mock("../stats-chart/stats-chart", () => ({
  StatsChart: () => <div data-testid="stats-chart">chart</div>,
}));

const COLUMN_HEADERS = { label: "État", value: "Nombre de signalements" };

const BASE_PROPS = {
  id: "etat",
  title: "Répartition des signalements par état",
  chartType: "pie" as const,
  labels: ["Traité", "Fermé"],
  values: [12, 5],
  columnHeaders: COLUMN_HEADERS,
  exportFileName: "repartition-par-etat",
};

describe("StatCard", () => {
  it("affiche le graphique par défaut", () => {
    render(<StatCard {...BASE_PROPS} />);
    expect(screen.getByTestId("stats-chart")).toBeInTheDocument();
  });

  it("affiche la description sous le titre quand elle est fournie", () => {
    render(
      <StatCard
        {...BASE_PROPS}
        description="Un signalement est pris en charge au premier geste de l'opérateur."
      />,
    );
    expect(
      screen.getByText(
        "Un signalement est pris en charge au premier geste de l'opérateur.",
      ),
    ).toBeInTheDocument();
  });

  it("n'affiche rien sous le titre sans description", () => {
    render(<StatCard {...BASE_PROPS} />);
    expect(
      screen.queryByText(/pris en charge au premier geste/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2 }).nextElementSibling,
    ).toBeNull();
  });

  it("bascule vers la vue tableau", async () => {
    render(<StatCard {...BASE_PROPS} />);

    await userEvent.click(screen.getByRole("radio", { name: /Tableau/i }));

    expect(screen.queryByTestId("stats-chart")).not.toBeInTheDocument();
    // Les colonnes portent les en-têtes de la série, pas « Libellé »/« Valeur ».
    expect(screen.getByText("État")).toBeInTheDocument();
    expect(screen.getByText("Nombre de signalements")).toBeInTheDocument();
    expect(screen.getByText("Traité")).toBeInTheDocument();
  });

  it("affiche la colonne Part avec les pourcentages pour un donut", async () => {
    render(<StatCard {...BASE_PROPS} />);

    await userEvent.click(screen.getByRole("radio", { name: /Tableau/i }));

    expect(screen.getByText("Part")).toBeInTheDocument();
    // 12 / 17 ≈ 70,6 % et 5 / 17 ≈ 29,4 %
    expect(screen.getByText("70,6 %")).toBeInTheDocument();
    expect(screen.getByText("29,4 %")).toBeInTheDocument();
  });

  it("n'affiche pas la colonne Part pour un graphique en barres", async () => {
    render(<StatCard {...BASE_PROPS} chartType="bar" />);

    await userEvent.click(screen.getByRole("radio", { name: /Tableau/i }));

    expect(screen.queryByText("Part")).not.toBeInTheDocument();
  });

  it("exporte les données en xlsx via le menu", async () => {
    render(<StatCard {...BASE_PROPS} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Exporter les données/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Télécharger en \*\.xlsx/i }),
    );

    expect(exportStatsXlsx).toHaveBeenCalledWith(
      "repartition-par-etat",
      ["Traité", "Fermé"],
      [12, 5],
      COLUMN_HEADERS,
      true,
    );
  });

  it("déclenche la capture d'écran via le menu", async () => {
    render(<StatCard {...BASE_PROPS} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Exporter les données/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Capture d'écran/i }),
    );

    expect(captureStatChart).toHaveBeenCalledWith(
      expect.anything(),
      "repartition-par-etat",
    );
  });

  it("affiche l'état vide quand il n'y a aucune donnée", () => {
    render(<StatCard {...BASE_PROPS} values={[0, 0]} />);
    expect(
      screen.getByText(
        "Aucun signalement ne correspond à vos critères de filtrages.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("stats-chart")).not.toBeInTheDocument();
  });

  it("l'état vide propose de rouvrir le tiroir de filtres", async () => {
    const onOpenFilters = jest.fn();
    render(
      <StatCard
        {...BASE_PROPS}
        values={[0, 0]}
        onOpenFilters={onOpenFilters}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Modifier les filtres/i }),
    );

    expect(onOpenFilters).toHaveBeenCalled();
  });

  it("affiche la légende avec les pourcentages pour un donut", () => {
    render(<StatCard {...BASE_PROPS} />);
    // 12 / 17 ≈ 70,6 % et 5 / 17 ≈ 29,4 %
    expect(screen.getByText("Traité (70,6 %)")).toBeInTheDocument();
    expect(screen.getByText("Fermé (29,4 %)")).toBeInTheDocument();
  });

  it("affiche un chiffre vedette pour une part, avec le tableau en bascule", async () => {
    render(
      <StatCard
        {...BASE_PROPS}
        chartType="share"
        labels={["A", "B"]}
        values={[3, 1]}
        unit="signalements"
      />,
    );

    expect(screen.getByText("75 %")).toBeInTheDocument();
    expect(screen.getByText("A : 3 sur 4 signalements")).toBeInTheDocument();
    expect(screen.queryByTestId("stats-chart")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /Tableau/i }));

    expect(screen.getByText("Part")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("75 %")).toBeInTheDocument();
    expect(screen.getByText("25 %")).toBeInTheDocument();
  });

  it("affiche le nom de la série en légende pour un graphique en barres", () => {
    render(
      <StatCard {...BASE_PROPS} chartType="bar" seriesName="Signalements" />,
    );
    expect(screen.getByText("Signalements")).toBeInTheDocument();
    expect(screen.queryByText(/70,6 %/)).not.toBeInTheDocument();
  });
});
