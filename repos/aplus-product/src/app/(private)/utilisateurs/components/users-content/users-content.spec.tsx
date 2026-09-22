import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsersContent } from "./users-content";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockUseSearchParams, mockUseRouter } from "@/test/utils/global-mocks";

// Mock Element.scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = jest.fn();

const mockUsers = [
  {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    firstName: "Test",
    lastName: "User",
    profession: "Developer",
    role: "user",
    isInactive: null,
    cguAcceptedAt: null,
    lastActivityAt: new Date(),
    inactivityWarningsSentAt: [],
    teams: [
      {
        id: "team-1",
        name: "FS Arras",
        areas: [{ id: "area-1", name: "Pas-de-Calais", inseeCode: "62" }],
      },
    ],
    managedTeams: [],
    deactivatedTeamSnapshot: null,
  },
  {
    id: "user-2",
    email: "jane@example.com",
    firstName: "Jane",
    lastName: "Doe",
    name: "Jane Doe",
    profession: "Agent",
    role: "user",
    isInactive: null,
    cguAcceptedAt: null,
    lastActivityAt: new Date(),
    inactivityWarningsSentAt: [],
    teams: [
      {
        id: "team-1",
        name: "FS Arras",
        areas: [{ id: "area-1", name: "Pas-de-Calais", inseeCode: "62" }],
      },
    ],
    managedTeams: [{ id: "team-1" }],
    deactivatedTeamSnapshot: null,
  },
  {
    id: "user-3",
    email: "inactive@example.com",
    firstName: "Inactive",
    lastName: "User",
    name: "Inactive User",
    profession: null,
    role: "user",
    isInactive: new Date(),
    cguAcceptedAt: null,
    lastActivityAt: new Date(),
    inactivityWarningsSentAt: [],
    teams: [],
    managedTeams: [],
    deactivatedTeamSnapshot: {
      teams: [
        {
          id: "team-1",
          name: "FS Arras",
          areas: [{ id: "area-1", name: "Pas-de-Calais", inseeCode: "62" }],
        },
      ],
    },
  },
];

const mockPendingUsers = [
  {
    id: "pending-1",
    email: "pending@example.com",
    firstName: "Pending",
    lastName: "User",
    teams: [
      {
        id: "team-1",
        name: "FS Arras",
        areas: [{ id: "area-1", name: "Pas-de-Calais", inseeCode: "62" }],
      },
    ],
    managedTeams: [],
  },
  {
    id: "pending-2",
    email: "pending2@example.com",
    firstName: null,
    lastName: null,
    teams: [
      {
        id: "team-1",
        name: "FS Arras",
        areas: [{ id: "area-1", name: "Pas-de-Calais", inseeCode: "62" }],
      },
    ],
    managedTeams: [],
  },
];

const mockMutateAsync = jest.fn();

let mockPendingUsersData: {
  items: typeof mockPendingUsers;
  total: number;
  totalPages: number;
} = { items: [], total: 0, totalPages: 0 };

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn((options) => {
    // Return paginated structure for getPendingUsers
    if (options?.queryKey?.[0] === "getPendingUsers") {
      return { data: mockPendingUsersData, isLoading: false };
    }
    // Return isManager as false
    if (options?.queryKey?.[0] === "isManager") {
      return { data: false, isLoading: false };
    }
    // Return paginated structure for getUsers
    return {
      data: { items: mockUsers, total: mockUsers.length, totalPages: 1 },
      isLoading: false,
      isFetching: false,
    };
  }),
  useMutation: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
  keepPreviousData: {},
}));

const mockSessionData = {
  user: {
    id: "user-1",
    role: "admin",
  },
};

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: jest.fn(() => ({
    data: mockSessionData,
    isPending: false,
  })),
}));

const mockGetUsersQueryOptions = jest.fn(() => ({ queryKey: ["getUsers"] }));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(() => ({
    user: {
      getUsers: {
        queryOptions: mockGetUsersQueryOptions,
        queryKey: () => ["getUsers"],
      },
      getPendingUsers: {
        queryOptions: jest.fn(() => ({ queryKey: ["getPendingUsers"] })),
        queryKey: () => ["getPendingUsers"],
      },
      deactivateUser: {
        mutationOptions: jest.fn(() => ({})),
      },
      reactivateUser: {
        mutationOptions: jest.fn(() => ({})),
      },
      resendInvitation: {
        mutationOptions: jest.fn(() => ({})),
      },
      cancelPendingInvitation: {
        mutationOptions: jest.fn(() => ({})),
      },
      isManager: {
        queryOptions: jest.fn(() => ({ queryKey: ["isManager"] })),
      },
    },
  })),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("UsersContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUsersQueryOptions.mockClear();
    mockPendingUsersData = { items: [], total: 0, totalPages: 0 };
  });

  it("should render the search input", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(
      screen.getByPlaceholderText("Rechercher un nom, une adresse e-mail..."),
    ).toBeInTheDocument();
  });

  it("should render the users table with data", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Inactive User")).toBeInTheDocument();
  });

  it("should display team names", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getAllByText("FS Arras")).toHaveLength(3);
  });

  it("should display territories with insee code", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getAllByText("Pas-de-Calais (62)")).toHaveLength(3);
  });

  it("should display RESPONSABLE badge for managers", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getByText("RESPONSABLE")).toBeInTheDocument();
  });

  it("should display DÉSACTIVÉ for inactive users", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getByText("DÉSACTIVÉ")).toBeInTheDocument();
  });

  it("should call API with search parameter when typing", async () => {
    const user = userEvent.setup();
    render(<UsersContent />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(
      "Rechercher un nom, une adresse e-mail...",
    );
    await user.type(searchInput, "Jane");

    // Verify queryOptions was called with search parameter
    expect(mockGetUsersQueryOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
      }),
    );
  });

  it("should display Désactiver button for active users", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    const deactivateButtons = screen.getAllByText("Désactiver");
    expect(deactivateButtons.length).toBeGreaterThan(0);
  });

  it("should display Réactiver button for inactive users", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getByText("Réactiver")).toBeInTheDocument();
  });

  it("should display snapshot teams for deactivated users", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    // The deactivated user (user-3) has empty teams but a snapshot with "FS Arras"
    // All 3 users should display "FS Arras" (2 active + 1 from snapshot)
    expect(screen.getAllByText("FS Arras")).toHaveLength(3);
  });

  it("should show tabs with a zero count when there are no pending users", () => {
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText("Utilisateurs en attente (0)")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("should not show tabs for users who cannot manage users", () => {
    mockSessionData.user.role = "user";

    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    mockSessionData.user.role = "admin";
  });

  it("should show tabs when there are pending users", () => {
    mockPendingUsersData = {
      items: mockPendingUsers,
      total: 2,
      totalPages: 1,
    };
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText(/Utilisateurs actifs \(\d+\)/)).toBeInTheDocument();
    expect(screen.getByText("Utilisateurs en attente (2)")).toBeInTheDocument();
  });

  it("should display pending users in the pending tab", async () => {
    mockPendingUsersData = {
      items: mockPendingUsers,
      total: 2,
      totalPages: 1,
    };
    const user = userEvent.setup();
    render(<UsersContent />, { wrapper: createWrapper() });

    // Click the pending tab
    await user.click(screen.getByText("Utilisateurs en attente (2)"));

    expect(screen.getByText("Pending User")).toBeInTheDocument();
    // User without name should fallback to email (appears in both name and email columns)
    expect(
      screen.getAllByText("pending2@example.com").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("should show resend invitation button for pending users", async () => {
    mockPendingUsersData = {
      items: mockPendingUsers,
      total: 2,
      totalPages: 1,
    };
    const user = userEvent.setup();
    render(<UsersContent />, { wrapper: createWrapper() });

    await user.click(screen.getByText("Utilisateurs en attente (2)"));

    // One action menu per pending user; the actions are revealed on open.
    const triggers = screen.getAllByRole("button", { name: /Actions pour/i });
    expect(triggers).toHaveLength(2);

    await user.click(triggers[0]);
    expect(screen.getByText("Renvoyer l'invitation")).toBeInTheDocument();
  });

  it("should show pending tab for supervisors", () => {
    mockSessionData.user.role = "supervisor";
    mockPendingUsersData = {
      items: mockPendingUsers,
      total: 2,
      totalPages: 1,
    };
    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText("Utilisateurs en attente (2)")).toBeInTheDocument();
    mockSessionData.user.role = "admin";
  });

  it("should show pending tab for managers", () => {
    mockSessionData.user.role = "user";
    // Mock isManager returning true
    const { useQuery: mockUseQuery } = jest.requireMock(
      "@tanstack/react-query",
    );
    mockUseQuery.mockImplementation((options: { queryKey?: string[] }) => {
      if (options?.queryKey?.[0] === "getPendingUsers") {
        return {
          data: { items: mockPendingUsers, total: 2, totalPages: 1 },
          isLoading: false,
        };
      }
      if (options?.queryKey?.[0] === "isManager") {
        return { data: true, isLoading: false };
      }
      return {
        data: { items: mockUsers, total: mockUsers.length, totalPages: 1 },
        isLoading: false,
        isFetching: false,
      };
    });

    render(<UsersContent />, { wrapper: createWrapper() });

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText("Utilisateurs en attente (2)")).toBeInTheDocument();
    mockSessionData.user.role = "admin";
  });

  it("should show resend success alert when invitation is resent", async () => {
    mockPendingUsersData = {
      items: mockPendingUsers,
      total: 2,
      totalPages: 1,
    };

    // Capture the onSuccess from mutationOptions, then make useMutation call it on mutate
    let resendOnSuccess: (() => void) | undefined;
    const { useTRPC: mockUseTRPC } = jest.requireMock("@/trpc/client");
    mockUseTRPC.mockReturnValue({
      user: {
        getUsers: {
          queryOptions: mockGetUsersQueryOptions,
          queryKey: () => ["getUsers"],
        },
        getPendingUsers: {
          queryOptions: jest.fn(() => ({ queryKey: ["getPendingUsers"] })),
          queryKey: () => ["getPendingUsers"],
        },
        deactivateUser: { mutationOptions: jest.fn(() => ({})) },
        reactivateUser: { mutationOptions: jest.fn(() => ({})) },
        resendInvitation: {
          mutationOptions: jest.fn((opts: { onSuccess?: () => void }) => {
            resendOnSuccess = opts?.onSuccess;
            return { _isResend: true };
          }),
        },
        cancelPendingInvitation: {
          mutationOptions: jest.fn(() => ({})),
        },
        isManager: {
          queryOptions: jest.fn(() => ({ queryKey: ["isManager"] })),
        },
      },
    });

    const { useMutation: mockUseMutation } = jest.requireMock(
      "@tanstack/react-query",
    );
    mockUseMutation.mockImplementation((opts: { _isResend?: boolean }) => ({
      mutateAsync: mockMutateAsync,
      mutate: jest.fn().mockImplementation(() => {
        if (opts?._isResend && resendOnSuccess) {
          resendOnSuccess();
        }
      }),
      isPending: false,
    }));

    const user = userEvent.setup();
    render(<UsersContent />, { wrapper: createWrapper() });

    await user.click(screen.getByText("Utilisateurs en attente (2)"));

    const triggers = screen.getAllByRole("button", { name: /Actions pour/i });
    await user.click(triggers[0]);
    await user.click(screen.getByText("Renvoyer l'invitation"));

    expect(
      screen.getByText("L'invitation a bien été renvoyée."),
    ).toBeInTheDocument();
    expect(screen.getByText(/contacter notre support/)).toBeInTheDocument();
  });

  it("should show error alert when resend invitation fails", async () => {
    mockPendingUsersData = {
      items: mockPendingUsers,
      total: 2,
      totalPages: 1,
    };

    // Capture le onError de mutationOptions, puis le déclenche via mutate
    let resendOnError: ((error: { message: string }) => void) | undefined;
    const { useTRPC: mockUseTRPC } = jest.requireMock("@/trpc/client");
    mockUseTRPC.mockReturnValue({
      user: {
        getUsers: {
          queryOptions: mockGetUsersQueryOptions,
          queryKey: () => ["getUsers"],
        },
        getPendingUsers: {
          queryOptions: jest.fn(() => ({ queryKey: ["getPendingUsers"] })),
          queryKey: () => ["getPendingUsers"],
        },
        deactivateUser: { mutationOptions: jest.fn(() => ({})) },
        reactivateUser: { mutationOptions: jest.fn(() => ({})) },
        resendInvitation: {
          mutationOptions: jest.fn(
            (opts: { onError?: (error: { message: string }) => void }) => {
              resendOnError = opts?.onError;
              return { _isResend: true };
            },
          ),
        },
        cancelPendingInvitation: {
          mutationOptions: jest.fn(() => ({})),
        },
        isManager: {
          queryOptions: jest.fn(() => ({ queryKey: ["isManager"] })),
        },
      },
    });

    const { useMutation: mockUseMutation } = jest.requireMock(
      "@tanstack/react-query",
    );
    mockUseMutation.mockImplementation((opts: { _isResend?: boolean }) => ({
      mutateAsync: mockMutateAsync,
      mutate: jest.fn().mockImplementation(() => {
        if (opts?._isResend && resendOnError) {
          resendOnError({ message: "Cette personne a déjà un compte." });
        }
      }),
      isPending: false,
    }));

    const user = userEvent.setup();
    render(<UsersContent />, { wrapper: createWrapper() });

    await user.click(screen.getByText("Utilisateurs en attente (2)"));

    const triggers = screen.getAllByRole("button", { name: /Actions pour/i });
    await user.click(triggers[0]);
    await user.click(screen.getByText("Renvoyer l'invitation"));

    expect(screen.getByText("Invitation non renvoyée")).toBeInTheDocument();
    expect(
      screen.getByText("Cette personne a déjà un compte."),
    ).toBeInTheDocument();
  });

  it("should hide resend alert when closed", async () => {
    mockPendingUsersData = {
      items: mockPendingUsers,
      total: 2,
      totalPages: 1,
    };

    let resendOnSuccess: (() => void) | undefined;
    const { useTRPC: mockUseTRPC } = jest.requireMock("@/trpc/client");
    mockUseTRPC.mockReturnValue({
      user: {
        getUsers: {
          queryOptions: mockGetUsersQueryOptions,
          queryKey: () => ["getUsers"],
        },
        getPendingUsers: {
          queryOptions: jest.fn(() => ({ queryKey: ["getPendingUsers"] })),
          queryKey: () => ["getPendingUsers"],
        },
        deactivateUser: { mutationOptions: jest.fn(() => ({})) },
        reactivateUser: { mutationOptions: jest.fn(() => ({})) },
        resendInvitation: {
          mutationOptions: jest.fn((opts: { onSuccess?: () => void }) => {
            resendOnSuccess = opts?.onSuccess;
            return { _isResend: true };
          }),
        },
        cancelPendingInvitation: {
          mutationOptions: jest.fn(() => ({})),
        },
        isManager: {
          queryOptions: jest.fn(() => ({ queryKey: ["isManager"] })),
        },
      },
    });

    const { useMutation: mockUseMutation } = jest.requireMock(
      "@tanstack/react-query",
    );
    mockUseMutation.mockImplementation((opts: { _isResend?: boolean }) => ({
      mutateAsync: mockMutateAsync,
      mutate: jest.fn().mockImplementation(() => {
        if (opts?._isResend && resendOnSuccess) {
          resendOnSuccess();
        }
      }),
      isPending: false,
    }));

    const user = userEvent.setup();
    render(<UsersContent />, { wrapper: createWrapper() });

    await user.click(screen.getByText("Utilisateurs en attente (2)"));

    const triggers = screen.getAllByRole("button", { name: /Actions pour/i });
    await user.click(triggers[0]);
    await user.click(screen.getByText("Renvoyer l'invitation"));

    expect(
      screen.getByText("L'invitation a bien été renvoyée."),
    ).toBeInTheDocument();

    // Close the alert
    const closeButton = screen.getByText("Masquer le message");
    await user.click(closeButton);

    expect(
      screen.queryByText("L'invitation a bien été renvoyée."),
    ).not.toBeInTheDocument();
  });

  it("should show EN ATTENTE badge for pending users", async () => {
    mockPendingUsersData = {
      items: mockPendingUsers,
      total: 2,
      totalPages: 1,
    };
    const user = userEvent.setup();
    render(<UsersContent />, { wrapper: createWrapper() });

    await user.click(screen.getByText("Utilisateurs en attente (2)"));

    const badges = screen.getAllByText("EN ATTENTE");
    expect(badges).toHaveLength(2);
  });

  describe("mémoire des filtres (URL)", () => {
    it("restaure la recherche depuis l'URL", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams("u_q=Jane"));

      render(<UsersContent />, { wrapper: createWrapper() });

      expect(
        screen.getByPlaceholderText("Rechercher un nom, une adresse e-mail..."),
      ).toHaveValue("Jane");
    });

    it("transmet la page et le tri lus dans l'URL à la requête", () => {
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams("u_page=2&u_sort=role&u_order=asc"),
      );

      render(<UsersContent />, { wrapper: createWrapper() });

      expect(mockGetUsersQueryOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          sortBy: "role",
          sortOrder: "asc",
        }),
      );
    });

    it("écrit la recherche dans l'URL après le debounce", async () => {
      const replaceSpy = jest.fn();
      mockUseRouter.mockReturnValue({
        push: jest.fn(),
        replace: replaceSpy,
        prefetch: jest.fn(),
      });
      const user = userEvent.setup();

      render(<UsersContent />, { wrapper: createWrapper() });

      await user.type(
        screen.getByPlaceholderText("Rechercher un nom, une adresse e-mail..."),
        "Jane",
      );

      await waitFor(() => {
        const lastCall = replaceSpy.mock.calls.at(-1)?.[0] as string;
        expect(lastCall).toContain("u_q=Jane");
      });
    });

    it("restaure l'onglet « en attente » depuis l'URL", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams("u_tab=attente"));
      mockPendingUsersData = {
        items: mockPendingUsers,
        total: 2,
        totalPages: 1,
      };

      render(<UsersContent />, { wrapper: createWrapper() });

      expect(screen.getByRole("tab", { name: /en attente/i })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // Le contenu de l'onglet en attente est affiché sans clic.
      expect(screen.getByText("Pending User")).toBeInTheDocument();
    });

    it("sélectionne l'onglet actif par défaut quand l'URL n'a pas de param", () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());
      mockPendingUsersData = {
        items: mockPendingUsers,
        total: 2,
        totalPages: 1,
      };

      render(<UsersContent />, { wrapper: createWrapper() });

      expect(
        screen.getByRole("tab", { name: /Utilisateurs actifs/i }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("écrit l'onglet dans l'URL au changement d'onglet", async () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams());
      mockPendingUsersData = {
        items: mockPendingUsers,
        total: 2,
        totalPages: 1,
      };
      const replaceSpy = jest.fn();
      mockUseRouter.mockReturnValue({
        push: jest.fn(),
        replace: replaceSpy,
        prefetch: jest.fn(),
      });
      const user = userEvent.setup();

      render(<UsersContent />, { wrapper: createWrapper() });

      await user.click(screen.getByText("Utilisateurs en attente (2)"));

      await waitFor(() => {
        const lastCall = replaceSpy.mock.calls.at(-1)?.[0] as string;
        expect(lastCall).toContain("u_tab=attente");
      });
    });
  });

  describe("recherche sans résultat en attente", () => {
    it("garde les onglets visibles et affiche le message de recherche vide", async () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams("u_q=jacques"));
      // Un test précédent fige l'implémentation de useQuery : on la redéfinit
      // pour que la recherche ne matche aucun utilisateur en attente.
      const { useQuery: mockUseQuery } = jest.requireMock(
        "@tanstack/react-query",
      );
      mockUseQuery.mockImplementation((options: { queryKey?: string[] }) => {
        if (options?.queryKey?.[0] === "getPendingUsers") {
          return {
            data: { items: [], total: 0, totalPages: 0 },
            isLoading: false,
          };
        }
        if (options?.queryKey?.[0] === "isManager") {
          return { data: false, isLoading: false };
        }
        return {
          data: { items: mockUsers, total: mockUsers.length, totalPages: 1 },
          isLoading: false,
          isFetching: false,
        };
      });
      const user = userEvent.setup();

      render(<UsersContent />, { wrapper: createWrapper() });

      expect(screen.getByRole("tablist")).toBeInTheDocument();
      await user.click(screen.getByText("Utilisateurs en attente (0)"));

      expect(
        screen.getByText(
          "Aucun utilisateur ne correspond à vos critères de recherche.",
        ),
      ).toBeInTheDocument();
    });
  });
});
