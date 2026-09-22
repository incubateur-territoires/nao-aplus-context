import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockUseQuery } from "@/test/utils/global-mocks";
import { StatistiquesContent } from "./statistiques-content";

// `useTRPC` global (mockTRPC) ne connaît pas le router `stats` → on le surcharge
// localement pour exposer les requêtes de la page.
jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    stats: {
      getFilterOptions: {
        queryOptions: () => ({ queryKey: ["stats", "filterOptions"] }),
      },
      getDashboard: {
        queryOptions: () => ({ queryKey: ["stats", "dashboard"] }),
      },
      getCareDelaysByTeam: {
        queryOptions: () => ({ queryKey: ["stats", "careDelays"] }),
      },
    },
  }),
}));

// Les web-components dsfr-chart ne s'évaluent pas sous jsdom.
jest.mock("../stats-chart/stats-chart", () => ({
  StatsChart: () => <div data-testid="stats-chart">chart</div>,
}));

// Le bouton de la barre collante du bloc d'introduction : seul déclencheur du
// tiroir de filtres.
function getFiltersButton() {
  return screen.getByRole("button", { name: /Filtrer les statistiques/i });
}

const OPTIONS = {
  areas: [
    { id: "area-1", name: "Aisne" },
    { id: "area-2", name: "Oise" },
  ],
  authorOrganizations: [],
  authorTeams: [],
  requestedOrganizations: [],
  requestedTeams: [],
};

const SERIES = { labels: ["janv. 2024"], values: [10] };
const DASHBOARD = {
  reportsByMonth: SERIES,
  takenInChargeDelayDays: SERIES,
  takenInCharge72h: SERIES,
  reportsByStatus: SERIES,
  reportsByOperator: SERIES,
  treatmentDelay: SERIES,
  reportsRelevance: { labels: ["Pertinent", "Non pertinent"], values: [9, 1] },
};

const CARE_DELAYS = [
  {
    teamId: "team-1",
    teamName: "CAF 02",
    totalReports: 10,
    inTreatmentCount: 8,
    avgDelayBusinessDays: 1.5,
    underOneBusinessDayCount: 2,
    underTwoBusinessDaysCount: 5,
    underThreeBusinessDaysCount: 7,
  },
];

describe("StatistiquesContent", () => {
  beforeEach(() => {
    mockUseQuery.mockImplementation((options: { queryKey: unknown }) => {
      const key = JSON.stringify(options.queryKey);
      if (key.includes("filterOptions")) return { data: OPTIONS };
      if (key.includes("careDelays"))
        return { data: CARE_DELAYS, isFetching: false };
      return { data: DASHBOARD, isFetching: false };
    });
    jest.spyOn(window.history, "replaceState").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("affiche les graphiques et le tableau des délais de prise en charge", () => {
    render(<StatistiquesContent />);

    expect(
      screen.getByRole("heading", { name: "Nombre de signalements" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Délais de prise en charge" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CAF 02")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Un signalement adressé à plusieurs opérateurs compte une fois pour chacun. Le total est un nombre de sollicitations, pas de signalements.",
      ),
    ).toBeInTheDocument();
    // Même définition sous les deux graphiques de prise en charge.
    expect(
      screen.getAllByText(
        "Un signalement est pris en charge au premier geste de l'opérateur : passage en « En cours de traitement » ou directement en « Traité ». Les signalements fermés par l'aidant sans réponse ne sont pas comptés.",
      ),
    ).toHaveLength(2);
    // Le traitement porte sa propre définition, distincte de la prise en charge.
    expect(
      screen.getAllByText(
        "Un signalement est traité quand il passe au statut « Traité ». C'est une mesure distincte de la prise en charge, qui est le premier geste de l'opérateur : un signalement pris en charge en un jour peut être traité dix jours plus tard. Les signalements fermés sans avoir été traités ne sont pas comptés.",
      ),
    ).toHaveLength(1);
  });

  it("affiche une erreur explicite si le tableau de bord échoue", () => {
    mockUseQuery.mockImplementation((options: { queryKey: unknown }) => {
      const key = JSON.stringify(options.queryKey);
      if (key.includes("filterOptions")) return { data: OPTIONS };
      return { data: undefined, isFetching: false, isError: true };
    });

    render(<StatistiquesContent />);

    expect(
      screen.getByText("Les statistiques n'ont pas pu être chargées"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Chargement des statistiques…"),
    ).not.toBeInTheDocument();
  });

  it("le tiroir de filtres est fermé tant qu'on n'a pas cliqué sur « Filtrer les statistiques »", async () => {
    render(<StatistiquesContent />);

    expect(
      screen.queryByRole("heading", { name: "Filtrer les statistiques" }),
    ).not.toBeInTheDocument();

    await userEvent.click(getFiltersButton());

    expect(
      screen.getByRole("heading", { name: "Filtrer les statistiques" }),
    ).toBeInTheDocument();
  });

  it("reflète les filtres dans l'URL après le délai d'auto-application", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });

    render(<StatistiquesContent />);

    await user.click(getFiltersButton());
    await user.click(screen.getByPlaceholderText("Choisissez un département"));
    await user.click(screen.getByRole("option", { name: "Aisne" }));

    // Avant le debounce, l'URL n'a pas encore été mise à jour avec le filtre.
    expect(window.history.replaceState).not.toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("areaIds=area-1"),
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(window.history.replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      expect.stringContaining("areaIds=area-1"),
    );

    jest.useRealTimers();
  });
});
