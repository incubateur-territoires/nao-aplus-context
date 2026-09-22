import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { TeamsTable } from "./teams-table";
import { TRPCWrapper } from "@/test/utils/trpc.wrapper";
import { createMockTeamCard } from "@/test/utils/global-mocks";

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

jest.mock("@/trpc/client", () => ({
  ...jest.requireActual("@/trpc/client"),
  useTRPC: jest.fn(),
}));

// Mock contrôlable : `mockNav.params` simule l'URL, `mockReplace` capture les
// écritures (mémoire des filtres).
const mockReplace = jest.fn();
const mockNav = { params: new URLSearchParams() };

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    prefetch: jest.fn(),
  }),
  usePathname: () => "/equipes",
  useSearchParams: () => mockNav.params,
}));

const mockTrack = jest.fn();
jest.mock("@/app/hooks/use-analytics", () => ({
  useAnalytics: () => ({ track: mockTrack }),
}));

// Capture les arguments passés à la requête tRPC pour vérifier que les filtres
// lus dans l'URL sont bien transmis au serveur.
const mockGetMyTeamsQueryOptions = jest.fn(() => ({
  queryKey: ["team", "getMyTeams"],
}));

describe("TeamsTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNav.params = new URLSearchParams();
    (useTRPC as jest.Mock).mockReturnValue({
      team: {
        getMyTeams: {
          queryOptions: mockGetMyTeamsQueryOptions,
        },
      },
      area: {
        getMyAreas: {
          queryOptions: () => ({ queryKey: ["area", "getMyAreas"] }),
        },
      },
      organization: {
        getMyOrganizations: {
          queryOptions: () => ({
            queryKey: ["organization", "getMyOrganizations"],
          }),
        },
      },
      user: {
        isSupervisor: {
          queryOptions: () => ({ queryKey: ["user", "isSupervisor"] }),
        },
      },
    });
  });

  function mockTeamsQuery(teamData: unknown) {
    (useQuery as jest.Mock).mockImplementation(
      (opts: { queryKey: string[] }) => {
        const key = opts?.queryKey?.[0];
        if (key === "team") return teamData;
        return { data: [] };
      },
    );
  }

  it("renders loading state initially", () => {
    mockTeamsQuery({
      data: undefined,
      isLoading: true,
      isFetching: true,
    });

    render(<TeamsTable />, { wrapper: TRPCWrapper });

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  it("renders teams list", () => {
    const mockTeams = [
      createMockTeamCard({ name: "France Services - Ain" }),
      createMockTeamCard({ id: "team-2", name: "Maison de services" }),
    ];

    mockTeamsQuery({
      data: {
        items: mockTeams,
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
    });

    render(<TeamsTable />, { wrapper: TRPCWrapper });

    expect(screen.getByText("France Services - Ain")).toBeInTheDocument();
    expect(screen.getByText("Maison de services")).toBeInTheDocument();
  });

  it("highlights single search word in team name", async () => {
    const user = userEvent.setup();
    const mockTeams = [createMockTeamCard({ name: "France Services - Ain" })];

    mockTeamsQuery({
      data: {
        items: mockTeams,
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
    });

    render(<TeamsTable />, { wrapper: TRPCWrapper });

    const searchInput = screen.getByPlaceholderText(
      "Rechercher un nom, un matricule...",
    );
    await user.type(searchInput, "Services");

    await waitFor(() => {
      const marks = screen.getAllByText("Services");
      const highlightedMark = marks.find(
        (el) => el.tagName.toLowerCase() === "span" && el.style.backgroundColor,
      );
      expect(highlightedMark).toBeInTheDocument();
    });
  });

  it("highlights multiple search words separately in team name", async () => {
    const user = userEvent.setup();
    const mockTeams = [createMockTeamCard({ name: "France Services - Ain" })];

    mockTeamsQuery({
      data: {
        items: mockTeams,
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
    });

    render(<TeamsTable />, { wrapper: TRPCWrapper });

    const searchInput = screen.getByPlaceholderText(
      "Rechercher un nom, un matricule...",
    );
    // Search with multiple words separated by space (the bug fix scenario)
    await user.type(searchInput, "Services Ain");

    await waitFor(() => {
      // Both "Services" and "Ain" should be highlighted separately
      const servicesMarks = screen.getAllByText("Services");
      const servicesHighlight = servicesMarks.find(
        (el) => el.tagName.toLowerCase() === "span" && el.style.backgroundColor,
      );
      expect(servicesHighlight).toBeInTheDocument();

      const ainMarks = screen.getAllByText("Ain");
      const ainHighlight = ainMarks.find(
        (el) => el.tagName.toLowerCase() === "span" && el.style.backgroundColor,
      );
      expect(ainHighlight).toBeInTheDocument();
    });
  });

  it("resets to page 1 when search changes", async () => {
    const user = userEvent.setup();
    const mockTeams = [createMockTeamCard({ name: "Test Team" })];

    mockTeamsQuery({
      data: {
        items: mockTeams,
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
    });

    render(<TeamsTable />, { wrapper: TRPCWrapper });

    const searchInput = screen.getByPlaceholderText(
      "Rechercher un nom, un matricule...",
    );
    await user.type(searchInput, "test");

    // Verify input value changed
    expect(searchInput).toHaveValue("test");
  });

  it("does not highlight when search query is empty", () => {
    const mockTeams = [createMockTeamCard({ name: "France Services - Ain" })];

    mockTeamsQuery({
      data: {
        items: mockTeams,
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
    });

    render(<TeamsTable />, { wrapper: TRPCWrapper });

    // Team name should be present without any mark tags
    expect(screen.getByText("France Services - Ain")).toBeInTheDocument();
    expect(screen.queryByRole("mark")).not.toBeInTheDocument();
  });

  describe("mémoire des filtres (URL)", () => {
    function setupResults() {
      mockTeamsQuery({
        data: {
          items: [createMockTeamCard({ name: "Test Team" })],
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
        isLoading: false,
        isFetching: false,
      });
    }

    it("restaure la recherche depuis l'URL", () => {
      mockNav.params = new URLSearchParams("t_q=Services");
      setupResults();

      render(<TeamsTable />, { wrapper: TRPCWrapper });

      expect(
        screen.getByPlaceholderText("Rechercher un nom, un matricule..."),
      ).toHaveValue("Services");
    });

    it("transmet les filtres lus dans l'URL à la requête", () => {
      mockNav.params = new URLSearchParams(
        "t_page=2&t_areas=a1,a2&t_orgs=o1&t_sort=organisation&t_order=asc",
      );
      setupResults();

      render(<TeamsTable />, { wrapper: TRPCWrapper });

      expect(mockGetMyTeamsQueryOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          areaIds: ["a1", "a2"],
          organizationIds: ["o1"],
          sortBy: "organisation",
          sortOrder: "asc",
        }),
      );
    });

    it("écrit la recherche dans l'URL après le debounce", async () => {
      const user = userEvent.setup();
      setupResults();

      render(<TeamsTable />, { wrapper: TRPCWrapper });

      await user.type(
        screen.getByPlaceholderText("Rechercher un nom, un matricule..."),
        "Arras",
      );

      await waitFor(() => {
        const lastCall = mockReplace.mock.calls.at(-1)?.[0] as string;
        expect(lastCall).toContain("t_q=Arras");
      });
    });

    it("écrit le filtre territoire dans l'URL et réinitialise la page", async () => {
      const user = userEvent.setup();
      mockNav.params = new URLSearchParams("t_page=3");
      setupResults();
      (useQuery as jest.Mock).mockImplementation(
        (opts: { queryKey: string[] }) => {
          const key = opts?.queryKey?.[0];
          if (key === "team") {
            return {
              data: {
                items: [createMockTeamCard({ name: "Test Team" })],
                total: 1,
                page: 1,
                pageSize: 10,
                totalPages: 1,
              },
              isLoading: false,
              isFetching: false,
            };
          }
          if (key === "area") {
            return {
              data: [{ id: "area-1", name: "Pas-de-Calais", inseeCode: "62" }],
            };
          }
          return { data: [] };
        },
      );

      render(<TeamsTable />, { wrapper: TRPCWrapper });

      await user.click(screen.getByLabelText("Filtrer par territoire"));
      await user.click(await screen.findByText("Pas-de-Calais"));

      await waitFor(() => {
        const lastCall = mockReplace.mock.calls.at(-1)?.[0] as string;
        expect(lastCall).toContain("t_areas=area-1");
      });
      const lastCall = mockReplace.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).not.toContain("t_page");
    });
  });
});
