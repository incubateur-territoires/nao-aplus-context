import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { EditUserContent } from "./edit-user-content";
import { useTRPC } from "@/trpc/client";
import { OrganizationRole } from "@/generated/prisma/enums";
import { MOCK_IDS, MOCK_DATES, USER_ROLES, type UserRole } from "@/test/mocks";

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

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

const mockTrack = jest.fn();
jest.mock("@/app/hooks/use-analytics", () => ({
  useAnalytics: () => ({ track: mockTrack }),
}));

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

const mockModalOpen = jest.fn();
const mockModalClose = jest.fn();
jest.mock("@codegouvfr/react-dsfr/Modal", () => ({
  createModal: () => ({
    Component: ({
      children,
      title,
      buttons,
    }: {
      children: React.ReactNode;
      title: string;
      buttons: {
        children: string;
        onClick?: () => void;
        doClosesModal?: boolean;
        priority?: string;
      }[];
    }) => (
      <dialog data-testid="team-removal-modal" aria-label={title}>
        {children}
        <div>
          {buttons.map((btn, i) => (
            <button
              key={i}
              type="button"
              onClick={btn.onClick}
              data-testid={
                btn.priority === "secondary"
                  ? "modal-cancel-btn"
                  : "modal-confirm-btn"
              }
            >
              {btn.children}
            </button>
          ))}
        </div>
      </dialog>
    ),
    open: mockModalOpen,
    close: mockModalClose,
  }),
}));

jest.mock(
  "@/app/(private)/equipes/[id]/components/team-content/team-content-columns/team-content-columns",
  () => ({
    RemovalDebugPreview: () => null,
  }),
);

jest.mock(
  "@/app/(private)/utilisateurs/modifier/[userId]/transform-to-supervisor-section/transform-to-supervisor-section",
  () => ({
    TransformToSupervisorSection: ({ userId }: { userId: string }) => (
      <div data-testid="transform-to-supervisor-section" data-user-id={userId}>
        Transform section
      </div>
    ),
  }),
);

// Mock the reusable button components
jest.mock(
  "@/app/(private)/utilisateurs/components/deactivate-user-button/deactivate-user-button",
  () => ({
    DeactivateUserButton: ({
      onDeactivateUser,
      userId,
    }: {
      userId: string;
      onDeactivateUser: (id: string) => void;
    }) => (
      <button
        type="button"
        onClick={() => onDeactivateUser(userId)}
        data-testid="deactivate-button"
      >
        Désactiver l&apos;utilisateur
      </button>
    ),
  }),
);

jest.mock(
  "@/app/(private)/utilisateurs/components/reactivate-user-button/reactivate-user-button",
  () => ({
    ReactivateUserButton: ({
      onReactivateUser,
      userId,
    }: {
      userId: string;
      onReactivateUser: (id: string) => void;
    }) => (
      <button
        type="button"
        onClick={() => onReactivateUser(userId)}
        data-testid="reactivate-button"
      >
        Réactiver l&apos;utilisateur
      </button>
    ),
  }),
);

function createMockFullUser(
  overrides?: Partial<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    profession: string | null;
    role: UserRole;
    isInactive: Date | null;
    teams: {
      id: string;
      name: string;
      organization: { id: string; name: string; shortName: string };
      areas: { id: string; name: string; inseeCode: string | null }[];
      managers: { id: string }[];
    }[];
    managedTeams: {
      id: string;
      name: string;
      organization: { id: string; name: string; shortName: string };
      areas: { id: string; name: string; inseeCode: string | null }[];
    }[];
    supervisor: {
      id: string;
      areas: { id: string; name: string }[];
      organizations: { id: string; name: string; shortName: string }[];
    } | null;
  }>,
) {
  return {
    id: MOCK_IDS.USER_2,
    email: "jeanne.picot@example.com",
    firstName: "Jeanne",
    lastName: "Picot",
    name: "Jeanne Picot",
    phone: "0612345678",
    profession: "Aidant France Services",
    role: USER_ROLES.USER,
    isInactive: null,
    emailVerified: true,
    cguAcceptedAt: MOCK_DATES.JAN_1_2024,
    createdAt: MOCK_DATES.JAN_1_2024,
    updatedAt: MOCK_DATES.JAN_1_2024,
    lastActivityAt: MOCK_DATES.JAN_1_2024,
    inactivityWarningsSentAt: [],
    teams: [
      {
        id: MOCK_IDS.TEAM_1,
        name: "FS Arras",
        role: OrganizationRole.HELPER,
        organization: {
          id: MOCK_IDS.ORG_1,
          name: "France Services",
          shortName: "FS",
        },
        areas: [
          { id: MOCK_IDS.AREA_1, name: "Pas-de-Calais", inseeCode: "62" },
        ],
        managers: [{ id: MOCK_IDS.USER_1 }],
      },
    ],
    managedTeams: [],
    supervisor: null,
    ...overrides,
  };
}

function createMockCurrentUser(role: UserRole = USER_ROLES.ADMIN) {
  return {
    id: MOCK_IDS.USER_1,
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    name: "Admin User",
    role,
    teams: [],
  };
}

const mockAllTeams = [
  { id: MOCK_IDS.TEAM_1, name: "FS Arras" },
  { id: MOCK_IDS.TEAM_2, name: "FS Lyon" },
];

const mockAllAreas = [
  { id: MOCK_IDS.AREA_1, name: "Nord", inseeCode: "59" },
  { id: MOCK_IDS.AREA_2, name: "Pas-de-Calais", inseeCode: "62" },
];

const mockAllOrganizations = [
  { id: MOCK_IDS.ORG_1, name: "CPAM", shortName: "CPAM" },
  { id: "org-2", name: "Préfecture", shortName: "PREF" },
];

const mockUpdateUser = jest.fn().mockResolvedValue({ success: true });
const mockUpdateSupervisor = jest.fn().mockResolvedValue({ success: true });
const mockDeactivateUser = jest.fn().mockResolvedValue({ success: true });
const mockReactivateUser = jest.fn().mockResolvedValue({ success: true });
const mockQueryClient = {
  refetchQueries: jest.fn(),
  invalidateQueries: jest.fn(),
  getQueryData: jest.fn(),
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

function setupMocks(
  fullUser = createMockFullUser(),
  currentUser = createMockCurrentUser(),
) {
  (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);

  (useMutation as jest.Mock).mockImplementation((options) => {
    const key = JSON.stringify(options?.mutationKey || []);
    if (key.includes("updateUser")) {
      return { mutateAsync: mockUpdateUser, isPending: false };
    }
    if (key.includes("updateSupervisor")) {
      return { mutateAsync: mockUpdateSupervisor, isPending: false };
    }
    if (key.includes("deactivateUser")) {
      return { mutateAsync: mockDeactivateUser, isPending: false };
    }
    if (key.includes("reactivateUser")) {
      return { mutateAsync: mockReactivateUser, isPending: false };
    }
    return { mutateAsync: jest.fn(), isPending: false };
  });

  (useTRPC as jest.Mock).mockReturnValue({
    user: {
      getFullUserById: {
        queryOptions: () => ({
          queryKey: ["user", "getFullUserById", fullUser.id],
          queryFn: async () => fullUser,
        }),
      },
      getCurrentUser: {
        queryOptions: () => ({
          queryKey: ["user", "getCurrentUser"],
          queryFn: async () => currentUser,
        }),
      },
      getUsers: {
        queryOptions: () => ({
          queryKey: ["user", "getUsers"],
        }),
      },
      updateUser: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationKey: ["user", "updateUser"],
          mutationFn: mockUpdateUser,
          ...opts,
        }),
      },
      deactivateUser: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationKey: ["user", "deactivateUser"],
          mutationFn: mockDeactivateUser,
          ...opts,
        }),
      },
      reactivateUser: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationKey: ["user", "reactivateUser"],
          mutationFn: mockReactivateUser,
          ...opts,
        }),
      },
    },
    supervisor: {
      updateSupervisor: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationKey: ["supervisor", "updateSupervisor"],
          mutationFn: mockUpdateSupervisor,
          ...opts,
        }),
      },
    },
    team: {
      getTeams: {
        queryOptions: () => ({
          queryKey: ["team", "getTeams"],
          queryFn: async () => mockAllTeams,
        }),
      },
    },
    area: {
      getAreas: {
        queryOptions: () => ({
          queryKey: ["area", "getAreas"],
          queryFn: async () => mockAllAreas,
        }),
      },
    },
    organization: {
      getOrganizations: {
        queryOptions: () => ({
          queryKey: ["organization", "getOrganizations"],
          queryFn: async () => mockAllOrganizations,
        }),
      },
    },
    analytics: {
      getUserEvents: {
        queryOptions: (input: unknown) => ({
          queryKey: ["analytics", "getUserEvents", input],
        }),
      },
      getUserEventCounts: {
        queryOptions: (input: unknown) => ({
          queryKey: ["analytics", "getUserEventCounts", input],
        }),
      },
      getUserActivitySummary: {
        queryOptions: (input: unknown) => ({
          queryKey: ["analytics", "getUserActivitySummary", input],
        }),
      },
    },
  });

  (useQuery as jest.Mock).mockImplementation((options) => {
    const queryKey = JSON.stringify(options?.queryKey || []);
    if (queryKey.includes("getFullUserById")) {
      return { data: fullUser, isLoading: false };
    }
    if (queryKey.includes("getCurrentUser")) {
      return { data: currentUser, isLoading: false };
    }
    if (queryKey.includes("getTeams")) {
      return { data: mockAllTeams, isLoading: false };
    }
    if (queryKey.includes("getAreas")) {
      return { data: mockAllAreas, isLoading: false };
    }
    if (queryKey.includes("getOrganizations")) {
      return { data: mockAllOrganizations, isLoading: false };
    }
    if (queryKey.includes("getUserEventCounts")) {
      return { data: {}, isLoading: false };
    }
    if (queryKey.includes("getUserActivitySummary")) {
      return { data: null, isLoading: false };
    }
    if (queryKey.includes("getUserEvents")) {
      return {
        data: { items: [], total: 0, totalPages: 0 },
        isLoading: false,
      };
    }
    return { data: undefined, isLoading: false };
  });
}

describe("EditUserContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the user form with user data", async () => {
      setupMocks();
      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Jeanne Picot")).toBeInTheDocument();
      });

      expect(screen.getByText("Informations personnelles")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("jeanne.picot@example.com"),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Jeanne")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Picot")).toBeInTheDocument();
      expect(screen.getByDisplayValue("0612345678")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Aidant France Services"),
      ).toBeInTheDocument();
    });

    it("renders team badges", async () => {
      setupMocks();
      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("FS Arras")).toBeInTheDocument();
      });
    });

    it("renders nothing when user is loading", () => {
      setupMocks();
      (useQuery as jest.Mock).mockImplementation((options) => {
        const queryKey = JSON.stringify(options?.queryKey || []);
        if (queryKey.includes("getFullUserById")) {
          return { data: undefined, isLoading: true };
        }
        if (queryKey.includes("getCurrentUser")) {
          return { data: createMockCurrentUser(), isLoading: false };
        }
        return { data: undefined, isLoading: false };
      });

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      // Component returns null when user is not loaded
      expect(
        screen.queryByText("Informations personnelles"),
      ).not.toBeInTheDocument();
    });

    it("renders nothing when user is null", () => {
      setupMocks();
      (useQuery as jest.Mock).mockImplementation((options) => {
        const queryKey = JSON.stringify(options?.queryKey || []);
        if (queryKey.includes("getFullUserById")) {
          return { data: null, isLoading: false };
        }
        if (queryKey.includes("getCurrentUser")) {
          return { data: createMockCurrentUser(), isLoading: false };
        }
        return { data: undefined, isLoading: false };
      });

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      // Component returns null when user is not found
      expect(
        screen.queryByText("Informations personnelles"),
      ).not.toBeInTheDocument();
    });

    it("shows DÉSACTIVÉ badge when user is inactive", async () => {
      const inactiveUser = createMockFullUser({
        isInactive: MOCK_DATES.JAN_1_2024,
      });
      setupMocks(inactiveUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("DÉSACTIVÉ")).toBeInTheDocument();
      });
    });
  });

  describe("Form Validation", () => {
    it("validates required firstName field", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jeanne")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByDisplayValue("Jeanne");
      await user.clear(firstNameInput);

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Veuillez saisir votre prénom."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form Submission", () => {
    it("submits form with valid data", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jeanne")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByDisplayValue("Jeanne");
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Marie");

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          userId: MOCK_IDS.USER_2,
          email: "jeanne.picot@example.com",
          firstName: "Marie",
          lastName: "Picot",
          phone: "0612345678",
          profession: "Aidant France Services",
          teamIds: [MOCK_IDS.TEAM_1],
        });
      });
    });

    it("does not show success alert initially", async () => {
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Jeanne Picot")).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Les modifications ont bien été enregistrées."),
      ).not.toBeInTheDocument();
    });

    it("shows success alert after successful submission", async () => {
      let onSuccessCallback: (() => Promise<void>) | undefined;

      setupMocks();
      (useMutation as jest.Mock).mockImplementation((options) => {
        const key = JSON.stringify(options?.mutationKey || []);
        if (key.includes("updateUser") && options?.onSuccess) {
          onSuccessCallback = options.onSuccess;
        }
        if (key.includes("updateUser")) {
          return { mutateAsync: mockUpdateUser, isPending: false };
        }
        if (key.includes("deactivateUser")) {
          return { mutateAsync: mockDeactivateUser, isPending: false };
        }
        if (key.includes("reactivateUser")) {
          return { mutateAsync: mockReactivateUser, isPending: false };
        }
        return { mutateAsync: jest.fn(), isPending: false };
      });

      const user = userEvent.setup();
      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jeanne")).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      // Simulate the onSuccess callback
      await onSuccessCallback?.();

      await waitFor(() => {
        expect(
          screen.getByText("Les modifications ont bien été enregistrées."),
        ).toBeInTheDocument();
      });
    });

    it("hides success alert on new submission", async () => {
      let onSuccessCallback: (() => Promise<void>) | undefined;

      setupMocks();
      (useMutation as jest.Mock).mockImplementation((options) => {
        const key = JSON.stringify(options?.mutationKey || []);
        if (key.includes("updateUser") && options?.onSuccess) {
          onSuccessCallback = options.onSuccess;
        }
        if (key.includes("updateUser")) {
          return { mutateAsync: mockUpdateUser, isPending: false };
        }
        if (key.includes("deactivateUser")) {
          return { mutateAsync: mockDeactivateUser, isPending: false };
        }
        if (key.includes("reactivateUser")) {
          return { mutateAsync: mockReactivateUser, isPending: false };
        }
        return { mutateAsync: jest.fn(), isPending: false };
      });

      const user = userEvent.setup();
      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jeanne")).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      // Simulate success
      await onSuccessCallback?.();

      await waitFor(() => {
        expect(
          screen.getByText("Les modifications ont bien été enregistrées."),
        ).toBeInTheDocument();
      });

      // Submit again - alert should disappear
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.queryByText("Les modifications ont bien été enregistrées."),
        ).not.toBeInTheDocument();
      });
    });

    it("scrolls to top after successful submission", async () => {
      let onSuccessCallback: (() => Promise<void>) | undefined;

      setupMocks();
      (useMutation as jest.Mock).mockImplementation((options) => {
        const key = JSON.stringify(options?.mutationKey || []);
        if (key.includes("updateUser") && options?.onSuccess) {
          onSuccessCallback = options.onSuccess;
        }
        if (key.includes("updateUser")) {
          return { mutateAsync: mockUpdateUser, isPending: false };
        }
        if (key.includes("deactivateUser")) {
          return { mutateAsync: mockDeactivateUser, isPending: false };
        }
        if (key.includes("reactivateUser")) {
          return { mutateAsync: mockReactivateUser, isPending: false };
        }
        return { mutateAsync: jest.fn(), isPending: false };
      });

      const user = userEvent.setup();
      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jeanne")).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await onSuccessCallback?.();

      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: "smooth",
      });
    });

    it("calls updateUser mutation with correct data", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jeanne")).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalled();
      });
    });
  });

  describe("Deactivation/Reactivation", () => {
    it("shows deactivate button for admin when user is active", async () => {
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByTestId("deactivate-button")).toBeInTheDocument();
      });
    });

    it("shows reactivate button when user is inactive", async () => {
      const inactiveUser = createMockFullUser({
        isInactive: MOCK_DATES.JAN_1_2024,
      });
      setupMocks(inactiveUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByTestId("reactivate-button")).toBeInTheDocument();
      });
    });

    it("calls deactivateUser when deactivate button is clicked", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByTestId("deactivate-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("deactivate-button"));

      await waitFor(() => {
        expect(mockDeactivateUser).toHaveBeenCalledWith({
          userId: MOCK_IDS.USER_2,
        });
      });
    });

    it("calls reactivateUser when reactivate button is clicked", async () => {
      const user = userEvent.setup();
      const inactiveUser = createMockFullUser({
        isInactive: MOCK_DATES.JAN_1_2024,
      });
      setupMocks(inactiveUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByTestId("reactivate-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reactivate-button"));

      await waitFor(() => {
        expect(mockReactivateUser).toHaveBeenCalledWith({
          userId: MOCK_IDS.USER_2,
        });
      });
    });

    it("disables form inputs when user is inactive", async () => {
      const inactiveUser = createMockFullUser({
        isInactive: MOCK_DATES.JAN_1_2024,
      });
      setupMocks(inactiveUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Jeanne Picot")).toBeInTheDocument();
      });

      // Email input should be disabled
      const emailInput = screen.getByDisplayValue("jeanne.picot@example.com");
      expect(emailInput).toBeDisabled();
    });
  });

  describe("Impersonification Section", () => {
    it("shows the impersonation link", async () => {
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Impersonification")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Passer en mode .*Aperçu de l'utilisateur.*/),
      ).toBeInTheDocument();
    });
  });

  describe("Self-deactivation prevention", () => {
    it("hides deactivate section when viewing own profile", async () => {
      const currentUser = createMockCurrentUser();
      const fullUser = createMockFullUser({ id: currentUser.id });
      setupMocks(fullUser, currentUser);

      render(<EditUserContent userId={currentUser.id} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText(`${fullUser.firstName} ${fullUser.lastName}`),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Désactiver l'utilisateur"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("deactivate-button")).not.toBeInTheDocument();
    });

    it("shows deactivate section when viewing another user profile", async () => {
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Jeanne Picot")).toBeInTheDocument();
      });

      expect(screen.getByTestId("deactivate-button")).toBeInTheDocument();
    });
  });

  describe("Team removal confirmation modal", () => {
    it("does not open modal when submitting without removing teams", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Jeanne")).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalled();
      });

      expect(mockModalOpen).not.toHaveBeenCalled();
    });

    it("opens modal when submitting with a removed team", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("FS Arras")).toBeInTheDocument();
      });

      // Remove the team by clicking the dismiss button on the tag
      const dismissButton = screen
        .getByText("FS Arras")
        .closest("button") as HTMLElement;
      await user.click(dismissButton);

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockModalOpen).toHaveBeenCalled();
      });

      // updateUser should NOT have been called yet (waiting for confirmation)
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("shows removed team names in the modal", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("FS Arras")).toBeInTheDocument();
      });

      const dismissButton = screen
        .getByText("FS Arras")
        .closest("button") as HTMLElement;
      await user.click(dismissButton);

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockModalOpen).toHaveBeenCalled();
      });

      // Modal should contain the team name and user email
      expect(
        screen.getByText("FS Arras", { selector: "strong" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("jeanne.picot@example.com", { selector: "strong" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/seront réaffectés ou clôturés automatiquement/),
      ).toBeInTheDocument();
    });

    it("calls updateUser when confirming the modal", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("FS Arras")).toBeInTheDocument();
      });

      // Remove team
      const dismissButton = screen
        .getByText("FS Arras")
        .closest("button") as HTMLElement;
      await user.click(dismissButton);

      // Submit form
      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockModalOpen).toHaveBeenCalled();
      });

      // Click confirm button in modal
      const confirmButton = screen.getByTestId("modal-confirm-btn");
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({
          userId: MOCK_IDS.USER_2,
          email: "jeanne.picot@example.com",
          firstName: "Jeanne",
          lastName: "Picot",
          phone: "0612345678",
          profession: "Aidant France Services",
          teamIds: [],
        });
      });

      expect(mockModalClose).toHaveBeenCalled();
    });
  });

  describe("Supervisor section", () => {
    function createSupervisorUser(
      overrides?: Parameters<typeof createMockFullUser>[0],
    ) {
      return createMockFullUser({
        role: USER_ROLES.SUPERVISOR,
        supervisor: {
          id: "sup-1",
          areas: [{ id: MOCK_IDS.AREA_1, name: "Nord" }],
          organizations: [
            { id: MOCK_IDS.ORG_1, name: "CPAM", shortName: "CPAM" },
          ],
        },
        ...overrides,
      });
    }

    it("does not render supervisor section when user is not a supervisor", async () => {
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Jeanne Picot")).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Gestion du profil superviseur"),
      ).not.toBeInTheDocument();
    });

    it("does not render supervisor section when current user is not admin", async () => {
      const supervisorUser = createSupervisorUser();
      const nonAdminCurrentUser = createMockCurrentUser(USER_ROLES.USER);
      setupMocks(supervisorUser, nonAdminCurrentUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Jeanne Picot")).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Gestion du profil superviseur"),
      ).not.toBeInTheDocument();
    });

    it("renders supervisor section when admin edits a supervisor", async () => {
      const supervisorUser = createSupervisorUser();
      setupMocks(supervisorUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText("Gestion du profil superviseur"),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("Territoires à superviser")).toBeInTheDocument();
      expect(screen.getByText("Organisation à superviser")).toBeInTheDocument();
    });

    it("pre-fills selected territories and organizations from supervisor data", async () => {
      const supervisorUser = createSupervisorUser();
      setupMocks(supervisorUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText("Gestion du profil superviseur"),
        ).toBeInTheDocument();
      });

      // Tags for pre-selected area and organization should be visible
      const nordTags = screen.getAllByText("Nord");
      expect(nordTags.length).toBeGreaterThan(0);
      const cpamTags = screen.getAllByText("CPAM");
      expect(cpamTags.length).toBeGreaterThan(0);
    });

    it("calls updateSupervisor and updateUser when submitting a supervisor", async () => {
      const user = userEvent.setup();
      const supervisorUser = createSupervisorUser();
      setupMocks(supervisorUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText("Gestion du profil superviseur"),
        ).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateSupervisor).toHaveBeenCalledWith({
          userId: MOCK_IDS.USER_2,
          areaIds: [MOCK_IDS.AREA_1],
          organizationIds: [MOCK_IDS.ORG_1],
        });
      });

      expect(mockUpdateUser).toHaveBeenCalled();
    });

    it("removes a territory tag when clicking its dismiss button", async () => {
      const user = userEvent.setup();
      const supervisorUser = createSupervisorUser();
      setupMocks(supervisorUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText("Gestion du profil superviseur"),
        ).toBeInTheDocument();
      });

      // Find the dismiss button for "Nord" tag
      const nordTag = screen.getAllByText("Nord")[0];
      const dismissButton = nordTag.closest("button") as HTMLElement;
      await user.click(dismissButton);

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateSupervisor).toHaveBeenCalledWith({
          userId: MOCK_IDS.USER_2,
          areaIds: [],
          organizationIds: [MOCK_IDS.ORG_1],
        });
      });
    });

    it("removes an organization tag when clicking its dismiss button", async () => {
      const user = userEvent.setup();
      const supervisorUser = createSupervisorUser();
      setupMocks(supervisorUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText("Gestion du profil superviseur"),
        ).toBeInTheDocument();
      });

      const cpamTag = screen.getAllByText("CPAM")[0];
      const dismissButton = cpamTag.closest("button") as HTMLElement;
      await user.click(dismissButton);

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateSupervisor).toHaveBeenCalledWith({
          userId: MOCK_IDS.USER_2,
          areaIds: [MOCK_IDS.AREA_1],
          organizationIds: [],
        });
      });
    });

    it("hides the Équipe(s) card when the user is a supervisor", async () => {
      const supervisorUser = createSupervisorUser();
      setupMocks(supervisorUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText("Gestion du profil superviseur"),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("heading", { name: "Équipe(s)" }),
      ).not.toBeInTheDocument();
    });

    it("handles supervisor with no pre-existing areas/organizations", async () => {
      const user = userEvent.setup();
      const supervisorUser = createSupervisorUser({
        supervisor: {
          id: "sup-1",
          areas: [],
          organizations: [],
        },
      });
      setupMocks(supervisorUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText("Gestion du profil superviseur"),
        ).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateSupervisor).toHaveBeenCalledWith({
          userId: MOCK_IDS.USER_2,
          areaIds: [],
          organizationIds: [],
        });
      });
    });
  });

  describe("Transform to supervisor section", () => {
    it("renders the section for an admin viewing an active non-admin/non-supervisor user", async () => {
      setupMocks();

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByTestId("transform-to-supervisor-section"),
        ).toBeInTheDocument();
      });
    });

    it("hides the section when the current user is not admin", async () => {
      const nonAdmin = createMockCurrentUser(USER_ROLES.USER);
      setupMocks(createMockFullUser(), nonAdmin);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Jeanne Picot")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("transform-to-supervisor-section"),
      ).not.toBeInTheDocument();
    });

    it("hides the section when viewing your own profile", async () => {
      const currentUser = createMockCurrentUser();
      const fullUser = createMockFullUser({ id: currentUser.id });
      setupMocks(fullUser, currentUser);

      render(<EditUserContent userId={currentUser.id} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(
          screen.getByText(`${fullUser.firstName} ${fullUser.lastName}`),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("transform-to-supervisor-section"),
      ).not.toBeInTheDocument();
    });

    it("hides the section when the user is inactive", async () => {
      const inactiveUser = createMockFullUser({
        isInactive: MOCK_DATES.JAN_1_2024,
      });
      setupMocks(inactiveUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("DÉSACTIVÉ")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("transform-to-supervisor-section"),
      ).not.toBeInTheDocument();
    });

    it("hides the section when the user is already a supervisor", async () => {
      const supervisorUser = createMockFullUser({
        role: USER_ROLES.SUPERVISOR,
        supervisor: {
          id: "sup-1",
          areas: [],
          organizations: [],
        },
      });
      setupMocks(supervisorUser);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Jeanne Picot")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("transform-to-supervisor-section"),
      ).not.toBeInTheDocument();
    });

    it("hides the section when the user is an admin", async () => {
      const adminTarget = createMockFullUser({ role: USER_ROLES.ADMIN });
      setupMocks(adminTarget);

      render(<EditUserContent userId={MOCK_IDS.USER_2} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText("Jeanne Picot")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("transform-to-supervisor-section"),
      ).not.toBeInTheDocument();
    });
  });
});
