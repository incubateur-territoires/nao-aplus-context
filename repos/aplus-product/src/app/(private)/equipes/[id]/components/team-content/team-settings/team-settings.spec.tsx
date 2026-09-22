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
import { TeamSettings } from "./team-settings";
import { useTRPC } from "@/trpc/client";
import { MOCK_IDS, MOCK_DATES } from "@/test/mocks";
import { useSession } from "@/app/component/auth-provider/auth-provider";

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

// Mock window.scrollTo
Object.defineProperty(window, "scrollTo", {
  value: jest.fn(),
  writable: true,
});

// Mock Element.scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = jest.fn();

const mockTeam = {
  id: MOCK_IDS.TEAM_1,
  name: "Test Team",
  createdAt: MOCK_DATES.JAN_1_2024,
  updatedAt: MOCK_DATES.JAN_1_2024,
  organizationId: MOCK_IDS.ORG_1,
  role: "HELPER" as const,
  users: [],
  managers: [{ id: MOCK_IDS.USER_1 }],
};

const mockUpdateTeam = jest.fn().mockResolvedValue({
  ...mockTeam,
  name: "Updated Team",
});

const mockQueryClient = {
  refetchQueries: jest.fn().mockResolvedValue(undefined),
  getQueryData: jest.fn().mockReturnValue({
    ...mockTeam,
    name: "Updated Team",
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

describe("TeamSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1 } },
    });
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);
    (useMutation as jest.Mock).mockImplementation(() => ({
      mutateAsync: mockUpdateTeam,
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
        updateTeam: {
          mutationOptions: (opts?: Record<string, unknown>) => ({
            mutationKey: ["team", "updateTeam"],
            mutationFn: mockUpdateTeam,
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

  it("renders the settings form with team data", async () => {
    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Informations de l'équipe")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Test Team")).toBeInTheDocument();
  });

  it("renders all form fields", async () => {
    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText("Nom de l'équipe (obligatoire)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Adresse e-mail de l'équipe (optionnel)"),
      ).toBeInTheDocument();
      expect(screen.getByText("Description (optionnel)")).toBeInTheDocument();
    });
  });

  it("renders save button", async () => {
    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Enregistrer les modifications/i }),
      ).toBeInTheDocument();
    });
  });

  it("submits form with updated data", async () => {
    const user = userEvent.setup();
    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Team")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText("Nom de l'équipe (obligatoire)");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Team Name");

    const submitButton = screen.getByRole("button", {
      name: /Enregistrer les modifications/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateTeam).toHaveBeenCalledWith({
        id: MOCK_IDS.TEAM_1,
        name: "Updated Team Name",
        email: null,
        description: null,
      });
    });
  });

  it("validates required name field", async () => {
    const user = userEvent.setup();
    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Team")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText("Nom de l'équipe (obligatoire)");
    await user.clear(nameInput);

    const submitButton = screen.getByRole("button", {
      name: /Enregistrer les modifications/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Le nom de l'équipe est obligatoire."),
      ).toBeInTheDocument();
    });

    expect(mockUpdateTeam).not.toHaveBeenCalled();
  });

  it("affiche l'erreur zod/DSFR pour un email invalide et bloque la soumission", async () => {
    const user = userEvent.setup();
    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Team")).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/Adresse e-mail de l'équipe/);
    await user.clear(emailInput);
    await user.type(emailInput, "pas-un-email");

    const submitButton = screen.getByRole("button", {
      name: /Enregistrer les modifications/i,
    });
    await user.click(submitButton);

    // L'erreur provient de zod et s'affiche via le composant DSFR, pas via la
    // validation native du navigateur (le <form> est en noValidate).
    await waitFor(() => {
      expect(
        screen.getByText(
          "Veuillez saisir une adresse e-mail au format attendu, exemple : nom@domaine.fr",
        ),
      ).toBeInTheDocument();
    });

    expect(mockUpdateTeam).not.toHaveBeenCalled();
  });

  it("handles loading state by rendering nothing when team not yet loaded", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    // Component returns null when team is not loaded yet
    expect(
      screen.queryByText("Informations de l'équipe"),
    ).not.toBeInTheDocument();
  });

  it("handles team not found", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    // When team is undefined, isManager will be false, so component returns null
    // This test verifies the component handles undefined team gracefully
    expect(screen.queryByText("Équipe non trouvée.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Informations de l'équipe"),
    ).not.toBeInTheDocument();
  });

  it("shows success alert after successful submission", async () => {
    let onSuccessCallback: (() => Promise<void>) | undefined;
    (useMutation as jest.Mock).mockImplementation((options) => {
      onSuccessCallback = options?.onSuccess;
      return {
        mutateAsync: mockUpdateTeam,
        isPending: false,
      };
    });

    const user = userEvent.setup();
    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Team")).toBeInTheDocument();
    });

    // No alert initially
    expect(
      screen.queryByText("Les modifications ont bien été enregistrées."),
    ).not.toBeInTheDocument();

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
    (useMutation as jest.Mock).mockImplementation((options) => {
      onSuccessCallback = options?.onSuccess;
      return {
        mutateAsync: mockUpdateTeam,
        isPending: false,
      };
    });

    const user = userEvent.setup();
    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Team")).toBeInTheDocument();
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

  it("disables submit button when pending", async () => {
    (useMutation as jest.Mock).mockImplementation(() => ({
      mutateAsync: mockUpdateTeam,
      isPending: true,
    }));

    render(<TeamSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const submitButton = screen.getByRole("button", {
        name: /Enregistrer les modifications/i,
      });
      expect(submitButton).toBeDisabled();
    });
  });
});
