import { render, screen } from "@testing-library/react";
import { UserContent } from "./user-content";
import { createMockTeamCard } from "@/test/utils/global-mocks";
import { MOCK_IDS, USER_ROLES } from "@/test/mocks";
import { useQuery } from "@tanstack/react-query";

const mockPush = jest.fn();
const mockUseSession = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    team: {
      getMyTeams: {
        queryOptions: () => ({ queryKey: ["team", "getMyTeams"] }),
      },
    },
  }),
}));

jest.mock("@/lib/auth-client", () => ({
  useSession: () => mockUseSession(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

describe("UserContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render teams list with title", () => {
    const mockTeams = [
      createMockTeamCard({ id: "team-1", name: "Équipe Alpha" }),
      createMockTeamCard({ id: "team-2", name: "Équipe Beta" }),
    ];

    (useQuery as jest.Mock).mockReturnValue({
      data: { items: mockTeams, totalPages: 1 },
    });

    mockUseSession.mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
      isPending: false,
    });

    render(<UserContent />);

    expect(screen.getByText("Vos équipes")).toBeInTheDocument();
    expect(screen.getByText("Équipe Alpha")).toBeInTheDocument();
    expect(screen.getByText("Équipe Beta")).toBeInTheDocument();
  });

  it("should show create team button when user is manager of a team", () => {
    const mockTeams = [
      createMockTeamCard({
        id: "team-1",
        name: "Équipe Alpha",
        managers: [{ id: MOCK_IDS.USER_1 }] as ReturnType<
          typeof createMockTeamCard
        >["managers"],
      }),
    ];

    (useQuery as jest.Mock).mockReturnValue({
      data: { items: mockTeams, totalPages: 1 },
    });

    mockUseSession.mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
      isPending: false,
    });

    render(<UserContent />);

    expect(screen.getByText("Créer une équipe")).toBeInTheDocument();
  });

  it("should show create team button when user is admin", () => {
    const mockTeams = [
      createMockTeamCard({
        id: "team-1",
        name: "Équipe Alpha",
        managers: [],
      }),
    ];

    (useQuery as jest.Mock).mockReturnValue({
      data: { items: mockTeams, totalPages: 1 },
    });

    mockUseSession.mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
      isPending: false,
    });

    render(<UserContent />);

    expect(screen.getByText("Créer une équipe")).toBeInTheDocument();
  });

  it("should NOT show create team button when user is not manager and not admin", () => {
    const mockTeams = [
      createMockTeamCard({
        id: "team-1",
        name: "Équipe Alpha",
        managers: [{ id: "other-user" }] as ReturnType<
          typeof createMockTeamCard
        >["managers"],
      }),
    ];

    (useQuery as jest.Mock).mockReturnValue({
      data: { items: mockTeams, totalPages: 1 },
    });

    mockUseSession.mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
      isPending: false,
    });

    render(<UserContent />);

    expect(screen.queryByText("Créer une équipe")).not.toBeInTheDocument();
  });

  it("should pass canEdit=true to TeamCard when user is manager of that team", () => {
    const mockTeams = [
      createMockTeamCard({
        id: "team-1",
        name: "Équipe Alpha",
        managers: [{ id: MOCK_IDS.USER_1 }] as ReturnType<
          typeof createMockTeamCard
        >["managers"],
      }),
    ];

    (useQuery as jest.Mock).mockReturnValue({
      data: { items: mockTeams, totalPages: 1 },
    });

    mockUseSession.mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
      isPending: false,
    });

    render(<UserContent />);

    // When canEdit is true, "Modifier l'équipe" button is shown
    expect(screen.getByText("Modifier l'équipe")).toBeInTheDocument();
  });

  it("should pass canEdit=false to TeamCard when user is not manager", () => {
    const mockTeams = [
      createMockTeamCard({
        id: "team-1",
        name: "Équipe Alpha",
        managers: [{ id: "other-user" }] as ReturnType<
          typeof createMockTeamCard
        >["managers"],
      }),
    ];

    (useQuery as jest.Mock).mockReturnValue({
      data: { items: mockTeams, totalPages: 1 },
    });

    mockUseSession.mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
      isPending: false,
    });

    render(<UserContent />);

    // When canEdit is false, "Voir l'équipe" button is shown
    expect(screen.getByText("Voir l'équipe")).toBeInTheDocument();
    expect(screen.queryByText("Modifier l'équipe")).not.toBeInTheDocument();
  });

  it("should pass canEdit=true to TeamCard when user is admin even if not manager", () => {
    const mockTeams = [
      createMockTeamCard({
        id: "team-1",
        name: "Équipe Alpha",
        managers: [{ id: "other-user" }] as ReturnType<
          typeof createMockTeamCard
        >["managers"],
      }),
    ];

    (useQuery as jest.Mock).mockReturnValue({
      data: { items: mockTeams, totalPages: 1 },
    });

    mockUseSession.mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
      isPending: false,
    });

    render(<UserContent />);

    // Admin should see edit button
    expect(screen.getByText("Modifier l'équipe")).toBeInTheDocument();
  });
});
