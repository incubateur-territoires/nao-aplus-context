import { render, screen, fireEvent, within } from "@testing-library/react";
import { StatsBanner } from "./stats-banner";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

const PATHNAME = "/tous-les-signalements";

interface Scope {
  pending: number;
  inTreatment: number;
  treated: number;
  overdue: number;
  total: number;
}

const replaceState = jest.fn();

function scope(partial: Partial<Scope>): Scope {
  return {
    pending: 0,
    inTreatment: 0,
    treated: 0,
    overdue: 0,
    total: 0,
    ...partial,
  };
}

interface TeamStats {
  avgAssignmentDays: number | null;
  avgTreatmentDays: number | null;
  teamCount: number;
}

function setup({
  created = null,
  requested = null,
  teams = [{ id: "t1" }],
  teamStats = { avgAssignmentDays: null, avgTreatmentDays: null, teamCount: 1 },
  canExport = false,
  search = "",
}: {
  created?: Scope | null;
  requested?: Scope | null;
  teams?: { id: string }[];
  teamStats?: TeamStats;
  canExport?: boolean;
  search?: string;
} = {}) {
  (usePathname as jest.Mock).mockReturnValue(PATHNAME);
  (useRouter as jest.Mock).mockReturnValue({});
  (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(search));
  // Le filtrage utilise la native History API (pas router.replace) : pas
  // d'aller-retour serveur RSC.
  window.history.replaceState = replaceState;

  (useTRPC as jest.Mock).mockReturnValue({
    report: {
      getMyReportsStats: {
        queryOptions: () => ({ queryKey: ["stats"] }),
      },
      getMyTeamStats: {
        queryOptions: () => ({ queryKey: ["teamStats"] }),
      },
    },
    user: {
      getCurrentUser: {
        queryOptions: () => ({ queryKey: ["currentUser"] }),
      },
    },
  });

  (useQuery as jest.Mock).mockImplementation(
    (options: { queryKey: string[] }) => {
      if (options.queryKey[0] === "stats") {
        return { data: { created, requested } };
      }
      if (options.queryKey[0] === "teamStats") {
        return { data: teamStats };
      }
      return { data: { teams } };
    },
  );

  return render(<StatsBanner canExport={canExport} />);
}

describe("StatsBanner", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("agrège les compteurs des deux périmètres (créés + à examiner)", () => {
    setup({
      created: scope({
        pending: 2,
        inTreatment: 1,
        treated: 4,
        overdue: 1,
        total: 8,
      }),
      requested: scope({
        pending: 3,
        inTreatment: 5,
        treated: 0,
        overdue: 2,
        total: 10,
      }),
    });

    // en souffrance = 1 + 2
    expect(screen.getByText("3")).toBeInTheDocument();
    // en attente = 2 + 3 ; en cours = 1 + 5 ; traités = 4 + 0
    expect(screen.getByText("5")).toBeInTheDocument(); // en attente
    expect(screen.getByText("6")).toBeInTheDocument(); // en cours
    expect(screen.getByText("4")).toBeInTheDocument(); // traités
  });

  it("affiche le label d'onglet au singulier pour une seule équipe", () => {
    setup({ teams: [{ id: "t1" }] });
    expect(
      screen.getByRole("tab", { name: "Statistiques de votre équipe" }),
    ).toBeInTheDocument();
  });

  it("affiche le label d'onglet au pluriel pour plusieurs équipes", () => {
    setup({ teams: [{ id: "t1" }, { id: "t2" }] });
    expect(
      screen.getByRole("tab", { name: "Statistiques de vos équipes" }),
    ).toBeInTheDocument();
  });

  it("clic sur « en cours de traitement » filtre les deux tableaux si les deux profils existent", () => {
    setup({
      created: scope({ total: 5 }),
      requested: scope({ total: 3 }),
    });
    fireEvent.click(
      screen.getByRole("button", { name: /en cours de traitement/i }),
    );
    expect(replaceState).toHaveBeenCalledTimes(1);
    const url = replaceState.mock.calls[0][2] as string;
    expect(url).toContain("c_status=IN_TREATMENT");
    expect(url).toContain("r_status=IN_TREATMENT");
  });

  it("aidant pur : clic filtre le tableau des créés et défile dessus", () => {
    const target = document.createElement("div");
    target.id = "table-created";
    document.body.appendChild(target);

    setup({ created: scope({ pending: 2, total: 4 }) });
    fireEvent.click(
      screen.getByRole("button", { name: /en attente de prise en charge/i }),
    );
    const url = replaceState.mock.calls[0][2] as string;
    expect(url).toContain("c_status=PENDING_ASSIGNMENT");
    expect(url).not.toContain("r_status");
    expect(target.scrollIntoView).toHaveBeenCalled();
  });

  it("opérateur pur : clic filtre uniquement le tableau à examiner", () => {
    setup({ requested: scope({ inTreatment: 1, total: 2 }) });
    fireEvent.click(
      screen.getByRole("button", { name: /en cours de traitement/i }),
    );
    const url = replaceState.mock.calls[0][2] as string;
    expect(url).toContain("r_status=IN_TREATMENT");
    expect(url).not.toContain("c_status");
  });

  it("clic sur « en souffrance » pose le filtre overdue", () => {
    setup({ created: scope({ overdue: 1, total: 3 }) });
    fireEvent.click(screen.getByRole("button", { name: /en souffrance/i }));
    const url = replaceState.mock.calls[0][2] as string;
    expect(url).toContain("c_overdue=1");
    expect(url).not.toContain("c_status");
  });

  it("cartes non cliquables quand l'utilisateur n'a aucun signalement", () => {
    setup({ created: scope({ total: 0 }), requested: scope({ total: 0 }) });
    expect(screen.queryByRole("button", { name: /en souffrance/i })).toBeNull();
  });

  it("préserve les query params de l'autre tableau", () => {
    setup({ created: scope({ total: 5 }), search: "r_q=jean" });
    fireEvent.click(screen.getByRole("button", { name: /traités/i }));
    const url = replaceState.mock.calls[0][2] as string;
    expect(url).toContain("r_q=jean");
    expect(url).toContain("c_status=COMPLETED");
  });

  it("affiche le lien d'export (dans l'onglet équipe) uniquement si canExport est vrai", () => {
    const teamStats = {
      avgAssignmentDays: 2.5,
      avgTreatmentDays: 6.25,
      teamCount: 1,
    };
    const { rerender } = setup({ canExport: false, teamStats });
    fireEvent.click(
      screen.getByRole("tab", { name: "Statistiques de votre équipe" }),
    );
    expect(
      screen.queryByRole("link", { name: /exporter les signalements/i }),
    ).toBeNull();

    rerender(<StatsBanner canExport />);
    expect(
      screen.getByRole("link", { name: /exporter les signalements/i }),
    ).toBeInTheDocument();
  });

  it("le lien d'export pointe vers l'ancre du bloc d'export", () => {
    setup({
      canExport: true,
      teamStats: {
        avgAssignmentDays: 2.5,
        avgTreatmentDays: 6.25,
        teamCount: 1,
      },
    });
    fireEvent.click(
      screen.getByRole("tab", { name: "Statistiques de votre équipe" }),
    );
    expect(
      screen.getByRole("link", { name: /exporter les signalements/i }),
    ).toHaveAttribute("href", "#export-reports");
  });

  it("rend les deux onglets du bandeau", () => {
    setup();
    const tablist = screen.getByRole("tablist");
    expect(
      within(tablist).getByRole("tab", { name: "Vos signalements" }),
    ).toBeInTheDocument();
  });

  it("onglet équipe : affiche les délais moyens formatés et le lien", () => {
    setup({
      teamStats: {
        avgAssignmentDays: 2.5,
        avgTreatmentDays: 6.25,
        teamCount: 1,
      },
    });
    fireEvent.click(
      screen.getByRole("tab", { name: "Statistiques de votre équipe" }),
    );
    expect(screen.getByText("2 jours et 12 heures")).toBeInTheDocument();
    expect(screen.getByText("6 jours et 6 heures")).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: /voir toutes les statistiques/i,
    });
    expect(link).toHaveAttribute("href", "/statistiques");
  });

  it("onglet équipe : message de repli quand aucune statistique", () => {
    setup({
      teamStats: {
        avgAssignmentDays: null,
        avgTreatmentDays: null,
        teamCount: 1,
      },
    });
    fireEvent.click(
      screen.getByRole("tab", { name: "Statistiques de votre équipe" }),
    );
    expect(
      screen.getByText(/ne sont pas encore disponibles/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /voir toutes les statistiques/i }),
    ).toBeNull();
  });
});
