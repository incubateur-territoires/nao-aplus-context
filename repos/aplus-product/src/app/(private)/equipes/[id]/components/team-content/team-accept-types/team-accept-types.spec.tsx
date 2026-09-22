import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { TeamAcceptTypes } from "./team-accept-types";
import { useTRPC } from "@/trpc/client";
import { MOCK_IDS, MOCK_DATES } from "@/test/mocks";
import { TeamType } from "@/generated/prisma/enums";
import { useSession } from "@/app/component/auth-provider/auth-provider";

const ALL_TEAM_TYPES = Object.values(TeamType);

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
    useMutation: jest.fn(),
    useQueryClient: jest.fn(),
  };
});

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: jest.fn(),
}));

Object.defineProperty(window, "scrollTo", {
  value: jest.fn(),
  writable: true,
});

Element.prototype.scrollIntoView = jest.fn();

const mockTeam = {
  id: MOCK_IDS.TEAM_1,
  name: "Test Team",
  createdAt: MOCK_DATES.JAN_1_2024,
  updatedAt: MOCK_DATES.JAN_1_2024,
  organizationId: MOCK_IDS.ORG_1,
  role: "OPERATOR" as const,
  users: [],
  managers: [{ id: MOCK_IDS.USER_1 }],
  acceptTypes: ALL_TEAM_TYPES,
};

const mockUpdateAcceptTypes = jest.fn().mockResolvedValue({
  ...mockTeam,
  acceptTypes: [TeamType.OPERATOR],
});

const mockQueryClient = {
  refetchQueries: jest.fn().mockResolvedValue(undefined),
  getQueryData: jest.fn().mockReturnValue({
    ...mockTeam,
    acceptTypes: [TeamType.OPERATOR],
  }),
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("TeamAcceptTypes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1 } },
    });
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);
    (useMutation as jest.Mock).mockImplementation(() => ({
      mutateAsync: mockUpdateAcceptTypes,
      isPending: false,
    }));
    (useTRPC as jest.Mock).mockReturnValue({
      team: {
        getTeamById: {
          queryOptions: (teamId: string) => ({
            queryKey: ["team", "getTeamById", teamId],
            queryFn: async () => mockTeam,
          }),
        },
        updateTeamAcceptTypes: {
          mutationOptions: (opts?: Record<string, unknown>) => ({
            mutationKey: ["team", "updateTeamAcceptTypes"],
            mutationFn: mockUpdateAcceptTypes,
            ...opts,
          }),
        },
      },
    });
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return {
          data: mockTeam,
          isLoading: false,
        };
      }
      return {
        data: undefined,
        isLoading: false,
      };
    });
  });

  it("renders the section title", async () => {
    render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Interlocuteurs de l'équipe"),
      ).toBeInTheDocument();
    });
  });

  it("renders the info alert", async () => {
    render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Choisissez à quels types d/),
      ).toBeInTheDocument();
    });
  });

  it("renders checkboxes for accept types", async () => {
    render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("de France Services (par défaut)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("des travailleurs sociaux historiques (par défaut)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("des autres opérateurs (par défaut)"),
      ).toBeInTheDocument();
      expect(screen.getByText("des TZNR")).toBeInTheDocument();
      expect(screen.getByText("des autres aidants")).toBeInTheDocument();
    });
  });

  it("renders save button", async () => {
    render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Enregistrer les modifications/i }),
      ).toBeInTheDocument();
    });
  });

  it("submits form with updated accept types", async () => {
    const user = userEvent.setup();
    render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Interlocuteurs de l'équipe"),
      ).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", {
      name: /Enregistrer les modifications/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateAcceptTypes).toHaveBeenCalledWith({
        id: MOCK_IDS.TEAM_1,
        acceptTypes: ALL_TEAM_TYPES,
      });
    });
  });

  it("returns null when user is not manager or admin", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "other-user" } },
    });

    const { container } = render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    expect(container.innerHTML).toBe("");
  });

  it("returns null when team is not an operator", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: { ...mockTeam, role: "HELPER" },
      isLoading: false,
    });

    const { container } = render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    expect(container.innerHTML).toBe("");
  });

  it("returns null when team is not loaded", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    expect(container.innerHTML).toBe("");
  });

  it("shows success alert after successful submission", async () => {
    let onSuccessCallback: (() => Promise<void>) | undefined;
    (useMutation as jest.Mock).mockImplementation((options) => {
      onSuccessCallback = options?.onSuccess;
      return {
        mutateAsync: mockUpdateAcceptTypes,
        isPending: false,
      };
    });

    const user = userEvent.setup();
    render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Interlocuteurs de l'équipe"),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Les modifications ont bien été enregistrées."),
    ).not.toBeInTheDocument();

    const submitButton = screen.getByRole("button", {
      name: /Enregistrer les modifications/i,
    });
    await user.click(submitButton);

    await onSuccessCallback?.();

    await waitFor(() => {
      expect(
        screen.getByText("Les modifications ont bien été enregistrées."),
      ).toBeInTheDocument();
    });
  });

  it("disables submit button when pending", async () => {
    (useMutation as jest.Mock).mockImplementation(() => ({
      mutateAsync: mockUpdateAcceptTypes,
      isPending: true,
    }));

    render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      expect(submitButton).toBeDisabled();
    });
  });

  it("renders for admin users", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "admin-user", role: "admin" } },
    });

    // Team has no managers, but user is admin
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return {
          data: { ...mockTeam, managers: [] },
          isLoading: false,
        };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAcceptTypes teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Interlocuteurs de l'équipe"),
      ).toBeInTheDocument();
    });
  });
});
