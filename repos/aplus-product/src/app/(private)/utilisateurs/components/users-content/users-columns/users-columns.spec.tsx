import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getUsersColumns, type UserRow } from "./users-columns";
import { MOCK_IDS, USER_ROLES } from "@/test/mocks";

interface ResendMutationOptions {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}

const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockResendMutationOptions = jest.fn(() => ({}));
jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    user: {
      resendInvitation: {
        mutationOptions: mockResendMutationOptions,
      },
      cancelPendingInvitation: {
        mutationOptions: jest.fn(() => ({})),
      },
      getPendingUsers: {
        queryKey: jest.fn(() => ["pending-users"]),
      },
    },
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useMutation: jest.fn(() => ({
    mutate: mockMutate,
    mutateAsync: jest.fn(),
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

function createMockUserRow(overrides?: Partial<UserRow>): UserRow {
  return {
    id: MOCK_IDS.USER_1,
    fullName: "Test User",
    email: "test@example.com",
    profession: "Developer",
    isInactive: false,
    role: USER_ROLES.USER,
    isManager: false,
    teams: [
      {
        id: MOCK_IDS.TEAM_1,
        name: "FS Arras",
        areas: [
          { id: MOCK_IDS.AREA_1, name: "Pas-de-Calais", inseeCode: "62" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("getUsersColumns", () => {
  const mockOnDeactivate = jest.fn();
  const mockOnReactivate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("column definitions", () => {
    it("should return 4 columns for non-admin users", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      expect(columns).toHaveLength(4);
    });

    it("should return 6 columns for users who can edit (includes edit and actions)", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
        undefined,
        "",
        undefined,
        true,
      );
      expect(columns).toHaveLength(6);
    });

    it("should return 5 columns for managers (no edit pencil column)", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
        undefined,
        "",
        undefined,
        false,
      );
      const columnIds = columns.map((col) => col.id);
      expect(columns).toHaveLength(5);
      expect(columnIds).not.toContain("edit");
      expect(columnIds).toContain("actions");
    });

    it("should have correct column ids", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
        undefined,
        "",
        undefined,
        true,
      );
      const columnIds = columns.map((col) => col.id);

      expect(columnIds).toContain("edit");
      expect(columnIds).toContain("member");
      expect(columnIds).toContain("teams");
      expect(columnIds).toContain("territories");
      expect(columnIds).toContain("role");
      expect(columnIds).toContain("actions");
    });
  });

  describe("member column", () => {
    it("should render fullName and email", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const memberColumn = columns.find((col) => col.id === "member");
      const row = createMockUserRow();

      const CellComponent = memberColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });
  });

  describe("role column", () => {
    it("should render ADMIN badge for admin users", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const roleColumn = columns.find((col) => col.id === "role");
      const row = createMockUserRow({ role: USER_ROLES.ADMIN });

      const CellComponent = roleColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("ADMIN")).toBeInTheDocument();
    });

    it("should render RESPONSABLE badge for managers", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const roleColumn = columns.find((col) => col.id === "role");
      const row = createMockUserRow({ isManager: true });

      const CellComponent = roleColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("RESPONSABLE")).toBeInTheDocument();
    });

    it("should render DÉSACTIVÉ for inactive users", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const roleColumn = columns.find((col) => col.id === "role");
      const row = createMockUserRow({ isInactive: true });

      const CellComponent = roleColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("DÉSACTIVÉ")).toBeInTheDocument();
    });

    it("should render profession when available", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const roleColumn = columns.find((col) => col.id === "role");
      const row = createMockUserRow({ profession: "Agent MFS" });

      const CellComponent = roleColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Agent MFS")).toBeInTheDocument();
    });
  });

  describe("teams column", () => {
    it("should render team names as links", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const teamsColumn = columns.find((col) => col.id === "teams");
      const row = createMockUserRow();

      const CellComponent = teamsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      const link = screen.getByText("FS Arras");
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe("A");
    });

    it("should show only 4 teams and an expand button when there are more than 4", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const teamsColumn = columns.find((col) => col.id === "teams");
      const row = createMockUserRow({
        teams: [
          { id: "t1", name: "Équipe 1", areas: [] },
          { id: "t2", name: "Équipe 2", areas: [] },
          { id: "t3", name: "Équipe 3", areas: [] },
          { id: "t4", name: "Équipe 4", areas: [] },
          { id: "t5", name: "Équipe 5", areas: [] },
          { id: "t6", name: "Équipe 6", areas: [] },
        ],
      });

      const CellComponent = teamsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Équipe 1")).toBeInTheDocument();
      expect(screen.getByText("Équipe 4")).toBeInTheDocument();
      expect(screen.queryByText("Équipe 5")).not.toBeInTheDocument();
      expect(screen.queryByText("Équipe 6")).not.toBeInTheDocument();
      expect(screen.getByText("+2 équipes")).toBeInTheDocument();
    });

    it("should use singular 'équipe' when only 1 remaining", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const teamsColumn = columns.find((col) => col.id === "teams");
      const row = createMockUserRow({
        teams: [
          { id: "t1", name: "Équipe 1", areas: [] },
          { id: "t2", name: "Équipe 2", areas: [] },
          { id: "t3", name: "Équipe 3", areas: [] },
          { id: "t4", name: "Équipe 4", areas: [] },
          { id: "t5", name: "Équipe 5", areas: [] },
        ],
      });

      const CellComponent = teamsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("+1 équipe")).toBeInTheDocument();
    });

    it("should not show expand button when 4 or fewer teams", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const teamsColumn = columns.find((col) => col.id === "teams");
      const row = createMockUserRow({
        teams: [
          { id: "t1", name: "Équipe 1", areas: [] },
          { id: "t2", name: "Équipe 2", areas: [] },
          { id: "t3", name: "Équipe 3", areas: [] },
          { id: "t4", name: "Équipe 4", areas: [] },
        ],
      });

      const CellComponent = teamsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("should expand and collapse teams on click", async () => {
      const user = userEvent.setup();
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const teamsColumn = columns.find((col) => col.id === "teams");
      const row = createMockUserRow({
        teams: [
          { id: "t1", name: "Équipe 1", areas: [] },
          { id: "t2", name: "Équipe 2", areas: [] },
          { id: "t3", name: "Équipe 3", areas: [] },
          { id: "t4", name: "Équipe 4", areas: [] },
          { id: "t5", name: "Équipe 5", areas: [] },
        ],
      });

      const CellComponent = teamsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      // Initially collapsed
      expect(screen.queryByText("Équipe 5")).not.toBeInTheDocument();

      // Expand
      await user.click(screen.getByText("+1 équipe"));
      expect(screen.getByText("Équipe 5")).toBeInTheDocument();
      expect(screen.getByText("Voir moins")).toBeInTheDocument();

      // Collapse
      await user.click(screen.getByText("Voir moins"));
      expect(screen.queryByText("Équipe 5")).not.toBeInTheDocument();
    });

    it("should have underline style on expand button", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const teamsColumn = columns.find((col) => col.id === "teams");
      const row = createMockUserRow({
        teams: [
          { id: "t1", name: "Équipe 1", areas: [] },
          { id: "t2", name: "Équipe 2", areas: [] },
          { id: "t3", name: "Équipe 3", areas: [] },
          { id: "t4", name: "Équipe 4", areas: [] },
          { id: "t5", name: "Équipe 5", areas: [] },
        ],
      });

      const CellComponent = teamsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      const button = screen.getByText("+1 équipe");
      expect(button).toHaveClass("underline");
      expect(button).toHaveClass("text-blue-primary");
    });
  });

  describe("territories column", () => {
    it("should render area names with insee codes", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const territoriesColumn = columns.find((col) => col.id === "territories");
      const row = createMockUserRow();

      const CellComponent = territoriesColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Pas-de-Calais (62)")).toBeInTheDocument();
    });

    it("should render unique areas only", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const territoriesColumn = columns.find((col) => col.id === "territories");
      const row = createMockUserRow({
        teams: [
          {
            id: MOCK_IDS.TEAM_1,
            name: "FS Arras",
            areas: [
              { id: MOCK_IDS.AREA_1, name: "Pas-de-Calais", inseeCode: "62" },
            ],
          },
          {
            id: "team-2",
            name: "FS Lens",
            areas: [
              { id: MOCK_IDS.AREA_1, name: "Pas-de-Calais", inseeCode: "62" },
            ],
          },
        ],
      });

      const CellComponent = territoriesColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      const areas = screen.getAllByText("Pas-de-Calais (62)");
      expect(areas).toHaveLength(1);
    });

    it("should show only 4 territories and an expand button when there are more than 4", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const territoriesColumn = columns.find((col) => col.id === "territories");
      const row = createMockUserRow({
        teams: [
          {
            id: "t1",
            name: "Équipe 1",
            areas: [
              { id: "a1", name: "Nord", inseeCode: "59" },
              { id: "a2", name: "Pas-de-Calais", inseeCode: "62" },
              { id: "a3", name: "Somme", inseeCode: "80" },
              { id: "a4", name: "Aisne", inseeCode: "02" },
              { id: "a5", name: "Oise", inseeCode: "60" },
              { id: "a6", name: "Seine-Maritime", inseeCode: "76" },
            ],
          },
        ],
      });

      const CellComponent = territoriesColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Nord (59)")).toBeInTheDocument();
      expect(screen.getByText("Pas-de-Calais (62)")).toBeInTheDocument();
      expect(screen.getByText("Somme (80)")).toBeInTheDocument();
      expect(screen.getByText("Aisne (02)")).toBeInTheDocument();
      expect(screen.queryByText("Oise (60)")).not.toBeInTheDocument();
      expect(screen.queryByText("Seine-Maritime (76)")).not.toBeInTheDocument();
      expect(screen.getByText("+2 territoires")).toBeInTheDocument();
    });

    it("should use singular 'territoire' when only 1 remaining", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const territoriesColumn = columns.find((col) => col.id === "territories");
      const row = createMockUserRow({
        teams: [
          {
            id: "t1",
            name: "Équipe 1",
            areas: [
              { id: "a1", name: "Nord", inseeCode: "59" },
              { id: "a2", name: "Pas-de-Calais", inseeCode: "62" },
              { id: "a3", name: "Somme", inseeCode: "80" },
              { id: "a4", name: "Aisne", inseeCode: "02" },
              { id: "a5", name: "Oise", inseeCode: "60" },
            ],
          },
        ],
      });

      const CellComponent = territoriesColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("+1 territoire")).toBeInTheDocument();
    });

    it("should expand and collapse territories on click", async () => {
      const user = userEvent.setup();
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const territoriesColumn = columns.find((col) => col.id === "territories");
      const row = createMockUserRow({
        teams: [
          {
            id: "t1",
            name: "Équipe 1",
            areas: [
              { id: "a1", name: "Nord", inseeCode: "59" },
              { id: "a2", name: "Pas-de-Calais", inseeCode: "62" },
              { id: "a3", name: "Somme", inseeCode: "80" },
              { id: "a4", name: "Aisne", inseeCode: "02" },
              { id: "a5", name: "Oise", inseeCode: "60" },
              { id: "a6", name: "Seine-Maritime", inseeCode: "76" },
            ],
          },
        ],
      });

      const CellComponent = territoriesColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      // Initially collapsed
      expect(screen.queryByText("Oise (60)")).not.toBeInTheDocument();
      expect(screen.queryByText("Seine-Maritime (76)")).not.toBeInTheDocument();

      // Expand
      await user.click(screen.getByText("+2 territoires"));
      expect(screen.getByText("Oise (60)")).toBeInTheDocument();
      expect(screen.getByText("Seine-Maritime (76)")).toBeInTheDocument();
      expect(screen.getByText("Voir moins")).toBeInTheDocument();

      // Collapse
      await user.click(screen.getByText("Voir moins"));
      expect(screen.queryByText("Oise (60)")).not.toBeInTheDocument();
      expect(screen.queryByText("Seine-Maritime (76)")).not.toBeInTheDocument();
    });

    it("uses supervisor.areas instead of team areas for supervisor users", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const territoriesColumn = columns.find((col) => col.id === "territories");
      const row = createMockUserRow({
        role: USER_ROLES.SUPERVISOR,
        teams: [], // supervisor not in teams
        supervisorAreas: [
          { id: MOCK_IDS.AREA_1, name: "Nord", inseeCode: "59" },
          { id: MOCK_IDS.AREA_2, name: "Allier", inseeCode: "03" },
        ],
      });

      const CellComponent = territoriesColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Nord (59)")).toBeInTheDocument();
      expect(screen.getByText("Allier (03)")).toBeInTheDocument();
    });

    it("falls back to team areas for supervisor when supervisorAreas is missing", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const territoriesColumn = columns.find((col) => col.id === "territories");
      const row = createMockUserRow({
        role: USER_ROLES.SUPERVISOR,
        // no supervisorAreas → falls back to team areas
      });

      const CellComponent = territoriesColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Pas-de-Calais (62)")).toBeInTheDocument();
    });

    it("uses team areas for non-supervisor users even when supervisorAreas is set", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const territoriesColumn = columns.find((col) => col.id === "territories");
      const row = createMockUserRow({
        role: USER_ROLES.USER,
        // supervisorAreas should be ignored for non-supervisors
        supervisorAreas: [{ id: "ignored", name: "Ignored Area" }],
      });

      const CellComponent = territoriesColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Pas-de-Calais (62)")).toBeInTheDocument();
      expect(screen.queryByText("Ignored Area")).not.toBeInTheDocument();
    });

    it("accessor returns supervisor area names for sorting/searching when user is supervisor", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
      );
      const territoriesColumn = columns.find((col) => col.id === "territories");
      const row = createMockUserRow({
        role: USER_ROLES.SUPERVISOR,
        teams: [],
        supervisorAreas: [
          { id: "a1", name: "Nord" },
          { id: "a2", name: "Allier" },
        ],
      });

      // accessorFn is a function on the column def
      const accessorFn = (
        territoriesColumn as { accessorFn?: (row: UserRow) => string }
      ).accessorFn;
      expect(accessorFn?.(row)).toBe("Nord, Allier");
    });
  });

  describe("resend invitation", () => {
    it("should render Renvoyer l'invitation button for pending users", async () => {
      const user = userEvent.setup();
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ isPending: true });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      // Actions are revealed by opening the accessible action menu.
      await user.click(screen.getByRole("button", { name: /Actions pour/i }));

      expect(screen.getByText("Renvoyer l'invitation")).toBeInTheDocument();
    });

    it("should not render Renvoyer l'invitation button for non-pending users", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ isPending: false });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(
        screen.queryByText("Renvoyer l'invitation"),
      ).not.toBeInTheDocument();
    });

    it("should not render any action for pending users when canEditUsers is false", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        false,
        true,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ isPending: true });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      const { container } = render(<CellComponent row={{ original: row }} />);

      expect(container.textContent).toBe("");
    });

    it("wires onError to refresh pending users and surface the message", () => {
      const onResendError = jest.fn();
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true, // canEditUsers
        true, // canDeactivateUsers
        undefined, // currentUserId
        "", // searchQuery
        undefined, // onResendSuccess
        false, // canEditUserDetails
        onResendError,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ isPending: true });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      // Le composant câble onError dans les options de la mutation. On le
      // récupère et on simule l'échec serveur (409 invitation orpheline).
      const lastCall = mockResendMutationOptions.mock.calls.at(-1) as
        | [ResendMutationOptions]
        | undefined;
      const options = lastCall?.[0];
      expect(options?.onError).toBeDefined();
      options!.onError!(new Error("Cette personne a déjà un compte."));

      expect(mockInvalidateQueries).toHaveBeenCalled();
      expect(onResendError).toHaveBeenCalledWith(
        "Cette personne a déjà un compte.",
      );
    });

    it("wires onSuccess to surface the success callback", () => {
      const onResendSuccess = jest.fn();
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true, // canEditUsers
        true, // canDeactivateUsers
        undefined, // currentUserId
        "", // searchQuery
        onResendSuccess,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ isPending: true });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      const lastCall = mockResendMutationOptions.mock.calls.at(-1) as
        | [ResendMutationOptions]
        | undefined;
      const options = lastCall?.[0];
      expect(options?.onSuccess).toBeDefined();
      options!.onSuccess!();

      expect(onResendSuccess).toHaveBeenCalled();
    });
  });

  describe("actions column", () => {
    it("should not render actions for admin users in the row", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ role: USER_ROLES.ADMIN });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      const { container } = render(<CellComponent row={{ original: row }} />);

      expect(container.textContent).toBe("");
    });

    it("should not render actions for current user (self-deactivation prevention)", () => {
      const currentUserId = MOCK_IDS.USER_1;
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
        currentUserId,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ id: currentUserId });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      const { container } = render(<CellComponent row={{ original: row }} />);

      expect(container.textContent).toBe("");
    });

    it("should render actions for other users when currentUserId is provided", () => {
      const currentUserId = MOCK_IDS.USER_1;
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
        currentUserId,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ id: MOCK_IDS.USER_2 });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Désactiver")).toBeInTheDocument();
    });

    it("should render Désactiver button for active users", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ isInactive: false });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Désactiver")).toBeInTheDocument();
    });

    it("should render Réactiver button for inactive users", () => {
      const columns = getUsersColumns(
        mockOnDeactivate,
        mockOnReactivate,
        true,
        true,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");
      const row = createMockUserRow({ isInactive: true });

      const CellComponent = actionsColumn?.cell as React.FC<{
        row: { original: UserRow };
      }>;
      render(<CellComponent row={{ original: row }} />);

      expect(screen.getByText("Réactiver")).toBeInTheDocument();
    });
  });
});
