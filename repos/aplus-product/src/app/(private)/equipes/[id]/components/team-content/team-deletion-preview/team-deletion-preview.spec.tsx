import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { TeamDeletionPreview } from "./team-deletion-preview";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MOCK_IDS } from "@/test/mocks";

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = "TestWrapper";
  return Wrapper;
}

describe("TeamDeletionPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useTRPC as jest.Mock).mockReturnValue({
      team: {
        previewDeleteTeam: {
          queryOptions: () => ({
            queryKey: ["team", "previewDeleteTeam"],
          }),
        },
      },
    });
  });

  it("shows loading state", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<TeamDeletionPreview teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByText("Chargement de l'aperçu des impacts..."),
    ).toBeInTheDocument();
  });

  it("returns null when no data", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    const { container } = render(
      <TeamDeletionPreview teamId={MOCK_IDS.TEAM_1} />,
      {
        wrapper: createWrapper(),
      },
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows empty state when no scenarios", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: { scenarios: [] },
      isLoading: false,
    });

    render(<TeamDeletionPreview teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByText("Aucun signalement actif affecté."),
    ).toBeInTheDocument();
  });

  it("shows closure count summary", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        scenarios: [
          {
            type: "APPLICANT_TEAM_CLOSED",
            reportId: "r1",
            reportSubject: "Problème CAF",
            reportApplicant: "Jean Dupont",
          },
          {
            type: "REQUESTED_TEAM_SOLE_CLOSED",
            reportId: "r2",
            reportSubject: "Accès logement",
            reportApplicant: "Marie Martin",
          },
        ],
      },
      isLoading: false,
    });

    render(<TeamDeletionPreview teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByText("Impact sur les signalements actifs"),
    ).toBeInTheDocument();
    expect(screen.getByText("2 signalement(s) clôturé(s)")).toBeInTheDocument();
  });

  it("shows notification count summary", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        scenarios: [
          {
            type: "REQUESTED_TEAM_REMOVED",
            reportId: "r1",
            reportSubject: "Problème Pôle emploi",
            reportApplicant: "Paul Durand",
          },
        ],
      },
      isLoading: false,
    });

    render(<TeamDeletionPreview teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByText("1 notification(s) envoyée(s)"),
    ).toBeInTheDocument();
  });

  it("shows both closure and notification counts", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        scenarios: [
          {
            type: "APPLICANT_TEAM_CLOSED",
            reportId: "r1",
            reportSubject: "Problème CAF",
            reportApplicant: "Jean Dupont",
          },
          {
            type: "REQUESTED_TEAM_REMOVED",
            reportId: "r2",
            reportSubject: "Accès logement",
            reportApplicant: "Marie Martin",
          },
        ],
      },
      isLoading: false,
    });

    render(<TeamDeletionPreview teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("1 signalement(s) clôturé(s)")).toBeInTheDocument();
    expect(
      screen.getByText("1 notification(s) envoyée(s)"),
    ).toBeInTheDocument();
  });

  it("shows scenario details with report info and labels", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        scenarios: [
          {
            type: "APPLICANT_TEAM_CLOSED",
            reportId: "r1",
            reportSubject: "Problème CAF",
            reportApplicant: "Jean Dupont",
          },
          {
            type: "REQUESTED_TEAM_REMOVED",
            reportId: "r2",
            reportSubject: "Accès logement",
            reportApplicant: "Marie Martin",
          },
          {
            type: "REQUESTED_TEAM_SOLE_CLOSED",
            reportId: "r3",
            reportSubject: "Carte vitale",
            reportApplicant: "Luc Bernard",
          },
        ],
      },
      isLoading: false,
    });

    render(<TeamDeletionPreview teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    // Report subjects
    expect(screen.getByText("Problème CAF")).toBeInTheDocument();
    expect(screen.getByText("Accès logement")).toBeInTheDocument();
    expect(screen.getByText("Carte vitale")).toBeInTheDocument();

    // Applicant names
    expect(screen.getByText("Usager : Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("Usager : Marie Martin")).toBeInTheDocument();
    expect(screen.getByText("Usager : Luc Bernard")).toBeInTheDocument();

    // Scenario labels
    expect(
      screen.getByText("→ Clôture (équipe demandeuse)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("→ Notification (retrait équipe destinataire)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("→ Clôture (seule équipe destinataire)"),
    ).toBeInTheDocument();
  });

  it("shows detail toggle", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        scenarios: [
          {
            type: "APPLICANT_TEAM_CLOSED",
            reportId: "r1",
            reportSubject: "Problème CAF",
            reportApplicant: "Jean Dupont",
          },
        ],
      },
      isLoading: false,
    });

    render(<TeamDeletionPreview teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Détail par signalement")).toBeInTheDocument();
  });
});
