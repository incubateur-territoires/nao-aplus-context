import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockCareDelayTeamRow } from "@/test/mocks";
import { exportTableXlsx } from "@/utils/export-stats-xlsx";
import { CareDelaysTable } from "./care-delays-table";

jest.mock("@/utils/export-stats-xlsx", () => ({
  exportTableXlsx: jest.fn(),
}));

const ROWS = [
  createMockCareDelayTeamRow({
    teamId: "team-1",
    teamName: "CAF Aisne",
    totalReports: 10,
    inTreatmentCount: 8,
    avgDelayBusinessDays: 1.5,
    underOneBusinessDayCount: 2,
    underTwoBusinessDaysCount: 4,
    underThreeBusinessDaysCount: 6,
  }),
  createMockCareDelayTeamRow({
    teamId: "team-2",
    teamName: "CPAM Oise",
    totalReports: 4,
    inTreatmentCount: 0,
    avgDelayBusinessDays: null,
    underOneBusinessDayCount: 0,
    underTwoBusinessDaysCount: 0,
    underThreeBusinessDaysCount: 0,
  }),
];

describe("CareDelaysTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("affiche une ligne par équipe avec ses agrégats", () => {
    render(<CareDelaysTable rows={ROWS} />);

    expect(screen.getByText("CAF Aisne")).toBeInTheDocument();
    expect(screen.getByText("CPAM Oise")).toBeInTheDocument();
    expect(screen.getByText("1,5")).toBeInTheDocument();
  });

  it("calcule les taux sur les signalements pris en charge", () => {
    render(<CareDelaysTable rows={[ROWS[0]]} />);

    // 4 / 8 = 50 % et 6 / 8 = 75 %
    expect(screen.getByText("50 %")).toBeInTheDocument();
    expect(screen.getByText("75 %")).toBeInTheDocument();
  });

  it("affiche « — » pour une équipe sans signalement pris en charge", () => {
    render(<CareDelaysTable rows={[ROWS[1]]} />);

    // Délai moyen + les deux taux.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("affiche l'état vide et propose de modifier les filtres", async () => {
    const onOpenFilters = jest.fn();
    render(<CareDelaysTable rows={[]} onOpenFilters={onOpenFilters} />);

    expect(
      screen.getByText(
        "Aucun signalement ne correspond à vos critères de filtrages.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Modifier les filtres/i }),
    );
    expect(onOpenFilters).toHaveBeenCalled();
  });

  it("n'annonce pas « aucun résultat » tant que les données chargent", () => {
    render(<CareDelaysTable rows={[]} isLoading />);

    expect(screen.getByText("Chargement du tableau…")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Aucun signalement ne correspond à vos critères de filtrages.",
      ),
    ).not.toBeInTheDocument();
  });

  it("signale une erreur de chargement plutôt qu'un tableau vide", () => {
    render(<CareDelaysTable rows={[]} hasError />);

    expect(
      screen.getByText("Ce tableau n'a pas pu être chargé"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Aucun signalement ne correspond à vos critères de filtrages.",
      ),
    ).not.toBeInTheDocument();
  });

  it("exporte le tableau en xlsx", async () => {
    render(<CareDelaysTable rows={ROWS} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Exporter les données/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Télécharger en \*\.xlsx/i }),
    );

    expect(exportTableXlsx).toHaveBeenCalledWith(
      "delais-de-prise-en-charge",
      expect.arrayContaining(["Nom de l'équipe"]),
      expect.arrayContaining([
        ["CAF Aisne", 10, 8, 1.5, 2, 4, "50 %", 6, "75 %"],
        ["CPAM Oise", 4, 0, "", 0, 0, "—", 0, "—"],
      ]),
    );
  });
});
