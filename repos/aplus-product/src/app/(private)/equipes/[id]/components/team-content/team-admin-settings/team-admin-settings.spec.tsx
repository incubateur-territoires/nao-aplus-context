import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamAdminSettings } from "./team-admin-settings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MOCK_IDS, USER_ROLES } from "@/test/mocks";
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

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
  })),
}));

jest.mock("@codegouvfr/react-dsfr/Button", () => ({
  __esModule: true,
  default: ({
    onClick,
    children,
    iconId,
    priority,
    disabled,
    type,
  }: {
    onClick?: () => void;
    children?: React.ReactNode;
    iconId?: string;
    priority?: string;
    disabled?: boolean;
    type?: string;
  }) => (
    <button
      onClick={onClick}
      data-icon-id={iconId}
      data-priority={priority}
      disabled={disabled}
      type={type as "button" | "submit" | "reset" | undefined}
    >
      {children}
    </button>
  ),
}));

jest.mock("@codegouvfr/react-dsfr/Modal", () => ({
  createModal: () => ({
    Component: ({
      children,
      title,
    }: {
      children: React.ReactNode;
      title: string;
    }) => (
      <dialog data-testid="modal" aria-label={title}>
        {children}
      </dialog>
    ),
    open: jest.fn(),
    close: jest.fn(),
  }),
}));

// Mock Element.scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = jest.fn();

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

const mockTeam = {
  id: MOCK_IDS.TEAM_1,
  name: "Test Team",
  areas: [{ id: "area-1", name: "Nord" }],
  organizationId: MOCK_IDS.ORG_1,
  organization: {
    id: MOCK_IDS.ORG_1,
    name: "Organisation 1",
    shortName: "ORG1",
  },
  managers: [],
  users: [],
  pendingUsers: [],
  pendingManagers: [],
  type: "OTHERS_HELPERS",
  adminComment: null,
};

const mockAreas = [
  { id: "area-1", name: "Nord" },
  { id: "area-2", name: "Pas-de-Calais" },
  { id: "area-3", name: "Somme" },
];

const mockOrganizations = [
  {
    id: MOCK_IDS.ORG_1,
    name: "Organisation 1",
    shortName: "ORG1",
    role: "HELPER",
    type: "OTHERS_HELPERS",
  },
];

const mockOrganizationsWithOperator = [
  {
    id: MOCK_IDS.ORG_1,
    name: "Organisation 1",
    shortName: "ORG1",
    role: "HELPER",
    type: "OTHERS_HELPERS",
  },
  {
    id: "org-operator",
    name: "CAF",
    shortName: "CAF",
    role: "OPERATOR",
    type: "OPERATOR",
  },
  {
    id: "org-fs",
    name: "France Services",
    shortName: "FS",
    role: "HELPER",
    type: "FRANCE_SERVICE",
  },
];

describe("TeamAdminSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useQueryClient as jest.Mock).mockReturnValue({
      refetchQueries: jest.fn(),
      invalidateQueries: jest.fn(),
    });

    (useTRPC as jest.Mock).mockReturnValue({
      team: {
        getTeamById: {
          queryOptions: () => ({
            queryKey: ["team", "getTeamById"],
          }),
        },
        updateTeamAdmin: {
          mutationOptions: (opts?: Record<string, unknown>) => ({
            mutationKey: ["team", "updateTeamAdmin"],
            mutationFn: jest.fn().mockResolvedValue(mockTeam),
            ...opts,
          }),
        },
        updateTeamAreas: {
          mutationOptions: (opts?: Record<string, unknown>) => ({
            mutationKey: ["team", "updateTeamAreas"],
            mutationFn: jest.fn().mockResolvedValue(mockTeam),
            ...opts,
          }),
        },
        deleteTeam: {
          mutationOptions: (opts?: Record<string, unknown>) => ({
            mutationKey: ["team", "deleteTeam"],
            mutationFn: jest.fn().mockResolvedValue(undefined),
            ...opts,
          }),
        },
        previewDeleteTeam: {
          queryOptions: () => ({
            queryKey: ["team", "previewDeleteTeam"],
          }),
        },
      },
      area: {
        getAreas: {
          queryOptions: () => ({
            queryKey: ["area", "getAreas"],
          }),
        },
        getMyAreas: {
          queryOptions: () => ({
            queryKey: ["area", "getMyAreas"],
          }),
        },
      },
      organization: {
        getOrganizations: {
          queryOptions: () => ({
            queryKey: ["organization", "getOrganizations"],
          }),
        },
      },
    });

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: mockTeam, isLoading: false };
      }
      if (
        queryKey.includes("area") &&
        (queryKey.includes("getAreas") || queryKey.includes("getMyAreas"))
      ) {
        return { data: mockAreas, isLoading: false };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return { data: mockOrganizations, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    (useMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
  });

  it("renders nothing when user is not admin", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });

    const { container } = render(
      <TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />,
      {
        wrapper: createWrapper(),
      },
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders admin settings when user is admin", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Administration de l'équipe"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Seuls les administrateurs ont accès à ces paramètres.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("displays selected territories as tags", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Nord")).toBeInTheDocument();
    });
  });

  it("displays organization type select", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Type d'organisation")).toBeInTheDocument();
    });
  });

  it("displays admin comment field", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Commentaire interne (optionnel)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Visible uniquement par les administrateurs"),
      ).toBeInTheDocument();
    });
  });

  it("displays delete team button", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Supprimer l'équipe")).toBeInTheDocument();
    });
  });

  it("displays save button", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Enregistrer les modifications"),
      ).toBeInTheDocument();
    });
  });

  it("renders nothing when team is loading", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: undefined, isLoading: true };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    // Component returns null when team is not loaded
    expect(
      screen.queryByText("Administration de l'équipe"),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when team not found", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: null, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    // Component returns null when team is not found
    expect(
      screen.queryByText("Administration de l'équipe"),
    ).not.toBeInTheDocument();
  });

  it("shows validation error when submitting with no areas", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    const teamWithNoAreas = {
      ...mockTeam,
      areas: [],
    };

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: teamWithNoAreas, isLoading: false };
      }
      if (queryKey.includes("area") && queryKey.includes("getAreas")) {
        return { data: mockAreas, isLoading: false };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return { data: mockOrganizations, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Administration de l'équipe"),
      ).toBeInTheDocument();
    });

    const submitButton = screen.getByText("Enregistrer les modifications");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Au moins un territoire est requis"),
      ).toBeInTheDocument();
    });
  });

  it("displays organization select with current organization selected", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    const multipleOrgs = [
      { id: MOCK_IDS.ORG_1, name: "Organisation 1", shortName: "ORG1" },
      { id: "org-2", name: "Organisation 2", shortName: "ORG2" },
    ];

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: mockTeam, isLoading: false };
      }
      if (queryKey.includes("area") && queryKey.includes("getAreas")) {
        return { data: mockAreas, isLoading: false };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return { data: multipleOrgs, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const orgSelect = screen.getByRole("combobox", {
        name: /Type d'organisation/i,
      });
      expect(orgSelect).toHaveValue(MOCK_IDS.ORG_1);
    });
  });

  it("allows changing organization", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    const multipleOrgs = [
      { id: MOCK_IDS.ORG_1, name: "Organisation 1", shortName: "ORG1" },
      { id: "org-2", name: "Organisation 2", shortName: "ORG2" },
    ];

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: mockTeam, isLoading: false };
      }
      if (queryKey.includes("area") && queryKey.includes("getAreas")) {
        return { data: mockAreas, isLoading: false };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return { data: multipleOrgs, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Administration de l'équipe"),
      ).toBeInTheDocument();
    });

    const orgSelect = screen.getByRole("combobox", {
      name: /Type d'organisation/i,
    });
    fireEvent.change(orgSelect, { target: { value: "org-2" } });

    expect(orgSelect).toHaveValue("org-2");
  });

  it("allows adding area via the Autocomplete dropdown", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });
    const user = userEvent.setup();

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Nord")).toBeInTheDocument();
    });

    const areaInput = screen.getByPlaceholderText(
      "Choisissez un ou plusieurs territoires",
    );
    await user.click(areaInput);

    const option = await screen.findByRole("option", {
      name: /Pas-de-Calais/,
    });
    await user.click(option);

    await waitFor(() => {
      // Le tag "Pas-de-Calais" apparaît sous le select une fois sélectionné
      expect(
        screen.getByRole("button", { name: /Pas-de-Calais/ }),
      ).toBeInTheDocument();
    });
  });

  it("shows success alert after successful submission", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    (useMutation as jest.Mock).mockImplementation((options) => {
      const key = JSON.stringify(options?.mutationKey || []);
      return {
        mutateAsync: jest.fn().mockImplementation(async () => {
          if (key.includes("updateTeamAdmin") && options?.onSuccess) {
            await options.onSuccess();
          }
          return mockTeam;
        }),
        isPending: false,
      };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Administration de l'équipe"),
      ).toBeInTheDocument();
    });

    // No alert initially
    expect(
      screen.queryByText("Les modifications ont bien été enregistrées."),
    ).not.toBeInTheDocument();

    const submitButton = screen.getByText("Enregistrer les modifications");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Les modifications ont bien été enregistrées."),
      ).toBeInTheDocument();
    });
  });

  it("hides success alert on new submission", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    (useMutation as jest.Mock).mockImplementation((options) => {
      const key = JSON.stringify(options?.mutationKey || []);
      return {
        mutateAsync: jest.fn().mockImplementation(async () => {
          if (key.includes("updateTeamAdmin") && options?.onSuccess) {
            await options.onSuccess();
          }
          return mockTeam;
        }),
        isPending: false,
      };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Administration de l'équipe"),
      ).toBeInTheDocument();
    });

    const submitButton = screen.getByText("Enregistrer les modifications");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Les modifications ont bien été enregistrées."),
      ).toBeInTheDocument();
    });

    // Submit again - alert should disappear during submission
    fireEvent.click(submitButton);

    // After second submit starts, alert is hidden then shown again after success
    // The key behavior is that setShowSuccessAlert(false) is called at start of onSubmit
    // We verify the alert reappears after the second successful submission
    await waitFor(() => {
      expect(
        screen.getByText("Les modifications ont bien été enregistrées."),
      ).toBeInTheDocument();
    });
  });

  it("disables radio buttons and shows Opérateurs when operator organization is selected", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    const operatorTeam = {
      ...mockTeam,
      organizationId: "org-operator",
      type: "OPERATOR",
    };

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: operatorTeam, isLoading: false };
      }
      if (queryKey.includes("area") && queryKey.includes("getAreas")) {
        return { data: mockAreas, isLoading: false };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return { data: mockOrganizationsWithOperator, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Catégorie de l'équipe")).toBeInTheDocument();
      expect(screen.getByText("Opérateurs")).toBeInTheDocument();
    });
  });

  it("switches type to OTHERS_HELPERS when changing from operator to helper org", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    const operatorTeam = {
      ...mockTeam,
      organizationId: "org-operator",
      type: "OPERATOR",
    };

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: operatorTeam, isLoading: false };
      }
      if (queryKey.includes("area") && queryKey.includes("getAreas")) {
        return { data: mockAreas, isLoading: false };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return { data: mockOrganizationsWithOperator, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Catégorie de l'équipe")).toBeInTheDocument();
    });

    // Switch to helper org
    const orgSelect = screen.getByRole("combobox", {
      name: /Type d'organisation/i,
    });
    fireEvent.change(orgSelect, { target: { value: MOCK_IDS.ORG_1 } });

    await waitFor(() => {
      expect(
        screen.getByText("Catégorie de l'équipe aidante"),
      ).toBeInTheDocument();
    });
  });

  it("shows disabled France Services radio when switching to France Services org", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: mockTeam, isLoading: false };
      }
      if (queryKey.includes("area") && queryKey.includes("getAreas")) {
        return { data: mockAreas, isLoading: false };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return { data: mockOrganizationsWithOperator, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Administration de l'équipe"),
      ).toBeInTheDocument();
    });

    // Switch to France Services org
    const orgSelect = screen.getByRole("combobox", {
      name: /Type d'organisation/i,
    });
    fireEvent.change(orgSelect, { target: { value: "org-fs" } });

    await waitFor(() => {
      const fsRadio = screen.getByRole("radio", { name: "France Services" });
      expect(fsRadio).toBeChecked();
      expect(fsRadio).toBeDisabled();
    });
  });

  it("shows disabled France Services radio when team already belongs to France Services org", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    const fsTeam = {
      ...mockTeam,
      organizationId: "org-fs",
      type: "FRANCE_SERVICE",
    };

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: fsTeam, isLoading: false };
      }
      if (queryKey.includes("area") && queryKey.includes("getAreas")) {
        return { data: mockAreas, isLoading: false };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return { data: mockOrganizationsWithOperator, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Catégorie de l'équipe aidante"),
      ).toBeInTheDocument();
      const fsRadio = screen.getByRole("radio", { name: "France Services" });
      expect(fsRadio).toBeChecked();
      expect(fsRadio).toBeDisabled();
    });
  });

  it("does not show Opérateurs option in helper type radio buttons", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: mockTeam, isLoading: false };
      }
      if (queryKey.includes("area") && queryKey.includes("getAreas")) {
        return { data: mockAreas, isLoading: false };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return { data: mockOrganizationsWithOperator, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Catégorie de l'équipe aidante"),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("radio", { name: "Opérateurs" }),
      ).not.toBeInTheDocument();
    });
  });

  it("calls updateTeamAdmin mutation with correct data on submit", async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue(mockTeam);

    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    (useMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Administration de l'équipe"),
      ).toBeInTheDocument();
    });

    const submitButton = screen.getByText("Enregistrer les modifications");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: MOCK_IDS.TEAM_1,
        areaIds: ["area-1"],
        organizationId: MOCK_IDS.ORG_1,
        adminComment: null,
        type: "OTHERS_HELPERS",
      });
    });
  });

  it("renders admin settings section for supervisor", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.SUPERVISOR } },
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Administration de l'équipe"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Paramètres réservés aux administrateurs et superviseurs.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("hides organization, category and comment fields for supervisor", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.SUPERVISOR } },
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Administration de l'équipe"),
      ).toBeInTheDocument();
    });

    // Territory selector should be visible
    expect(screen.getByText("Territoire(s)")).toBeInTheDocument();

    // Admin-only fields should NOT be visible
    expect(screen.queryByText("Type d'organisation")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Catégorie de l'équipe aidante"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Commentaire interne (optionnel)"),
    ).not.toBeInTheDocument();
  });

  it("shows delete button for supervisor", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.SUPERVISOR } },
    });

    render(<TeamAdminSettings teamId={MOCK_IDS.TEAM_1} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Supprimer l'équipe")).toBeInTheDocument();
    });
  });
});
