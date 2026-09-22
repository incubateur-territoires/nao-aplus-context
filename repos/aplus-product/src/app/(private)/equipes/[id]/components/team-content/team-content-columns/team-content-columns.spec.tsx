import {
  getTeamMembersColumns,
  RemovalDebugPreview,
  RemoveUserModal,
  type TeamMemberRow,
} from "./team-content-columns";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { CellContext } from "@tanstack/react-table";
import { MOCK_DATES, USER_ROLES } from "@/test/mocks";
import { TeamRole } from "@/types/team";

interface ResendMutationOptions {
  onSuccess?: () => void;
  onError?: (error: { message: string }) => void;
}

// Mock useTRPC
const mockQueryOptions = jest.fn();
const mockMutationOptions = jest.fn().mockReturnValue({});
const mockResendMutationOptions = jest.fn(() => ({}));
jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    team: {
      previewRemoveFromTeam: {
        queryOptions: mockQueryOptions,
      },
      getTeamById: {
        queryKey: jest.fn().mockReturnValue(["team", "test-team"]),
      },
      addManager: {
        mutationOptions: mockMutationOptions,
      },
      removeManager: {
        mutationOptions: mockMutationOptions,
      },
    },
    user: {
      resendInvitation: {
        mutationOptions: mockResendMutationOptions,
      },
    },
  }),
}));

// Mock useQuery and useMutation separately so we can control the return value
const mockUseQuery = jest.fn().mockReturnValue({
  data: undefined,
  isLoading: false,
});
const mockUseMutation = jest.fn().mockReturnValue({
  mutateAsync: jest.fn(),
});
const mockUseQueryClient = jest.fn().mockReturnValue({
  invalidateQueries: jest.fn(),
});
jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: () => mockUseQuery(),
  useMutation: () => mockUseMutation(),
  useQueryClient: () => mockUseQueryClient(),
}));

describe("getTeamMembersColumns", () => {
  const mockTeamMember: TeamMemberRow = {
    id: "user-1",
    fullName: "John Doe",
    lastName: "Doe",
    email: "john.doe@example.com",
    roleLabel: USER_ROLES.ADMIN,
    profession: "Developer",
    activityLabels: ["5 signalements"],
    activityMetrics: { signalements: 5, sollicitations: 0, participations: 0 },
    lastActivity: MOCK_DATES.JAN_1_2024,
    isPending: false,
    isInactive: false,
  };

  const mockOnRemoveUser = jest.fn();

  it("returns array of column definitions", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    expect(Array.isArray(columns)).toBe(true);
    expect(columns.length).toBeGreaterThan(0);
  });

  it("includes member column", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const memberColumn = columns.find((col) => col.id === "member");
    expect(memberColumn).toBeDefined();
    expect(memberColumn?.enableSorting).toBe(true);
  });

  it("member column accessorFn returns lastName for sorting", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const memberColumn = columns.find((col) => col.id === "member");

    expect(memberColumn).toBeDefined();
    if (memberColumn && "accessorFn" in memberColumn) {
      const result = memberColumn.accessorFn(mockTeamMember, 0);
      expect(result).toBe("Doe");
    }
  });

  it("member column cell renders fullName and email", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const memberColumn = columns.find((col) => col.id === "member");

    expect(memberColumn).toBeDefined();
    if (
      memberColumn &&
      "cell" in memberColumn &&
      typeof memberColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: mockTeamMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      const { container } = render(<>{memberColumn.cell(mockCellContext)}</>);
      expect(container.textContent).toContain("John Doe");
      expect(container.textContent).toContain("john.doe@example.com");
    }
  });

  it("includes role column", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const roleColumn = columns.find((col) => col.id === "role");
    expect(roleColumn).toBeDefined();
    expect(roleColumn?.enableSorting).toBe(true);
  });

  it("role column accessorFn returns roleLabel", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const roleColumn = columns.find((col) => col.id === "role");

    expect(roleColumn).toBeDefined();
    if (roleColumn && "accessorFn" in roleColumn) {
      const result = roleColumn.accessorFn(mockTeamMember, 0);
      expect(result).toBe(USER_ROLES.ADMIN);
    }
  });

  it("role column cell hides roleLabel when role is USER", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const roleColumn = columns.find((col) => col.id === "role");

    const userMember: TeamMemberRow = {
      ...mockTeamMember,
      roleLabel: USER_ROLES.USER,
    };

    expect(roleColumn).toBeDefined();
    if (
      roleColumn &&
      "cell" in roleColumn &&
      typeof roleColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: userMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      const { container } = render(<>{roleColumn.cell(mockCellContext)}</>);
      expect(container.textContent).not.toContain(USER_ROLES.USER);
      expect(container.textContent).toContain("");
    }
  });

  it("role column cell shows roleLabel when role is not USER", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const roleColumn = columns.find((col) => col.id === "role");

    expect(roleColumn).toBeDefined();
    if (
      roleColumn &&
      "cell" in roleColumn &&
      typeof roleColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: mockTeamMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      const { container } = render(<>{roleColumn.cell(mockCellContext)}</>);
      expect(container.textContent).toContain(USER_ROLES.ADMIN);
      expect(container.textContent).toContain("admin");
    }
  });

  it("role column cell handles null profession", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const roleColumn = columns.find((col) => col.id === "role");

    const memberWithoutProfession: TeamMemberRow = {
      ...mockTeamMember,
      profession: null,
    };

    expect(roleColumn).toBeDefined();
    if (
      roleColumn &&
      "cell" in roleColumn &&
      typeof roleColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: memberWithoutProfession, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      const { container } = render(<>{roleColumn.cell(mockCellContext)}</>);
      expect(container.textContent).toBeTruthy();
    }
  });

  it("includes activity column", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const activityColumn = columns.find((col) => col.id === "activity");
    expect(activityColumn).toBeDefined();
    expect(activityColumn?.enableSorting).toBe(false);
  });

  it("activity column accessorFn returns activityLabels joined", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const activityColumn = columns.find((col) => col.id === "activity");

    expect(activityColumn).toBeDefined();
    if (activityColumn && "accessorFn" in activityColumn) {
      const result = activityColumn.accessorFn(mockTeamMember, 0);
      expect(result).toBe("5 signalements");
    }
  });

  it("includes last-activity column", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const lastActivityColumn = columns.find(
      (col) => col.id === "last-activity",
    );
    expect(lastActivityColumn).toBeDefined();
    expect(lastActivityColumn?.enableSorting).toBe(true);
  });

  it("last-activity column accessorFn returns lastActivity", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const lastActivityColumn = columns.find(
      (col) => col.id === "last-activity",
    );

    expect(lastActivityColumn).toBeDefined();
    if (lastActivityColumn && "accessorFn" in lastActivityColumn) {
      const result = lastActivityColumn.accessorFn(mockTeamMember, 0);
      expect(result).toEqual(MOCK_DATES.JAN_1_2024);
    }
  });

  it("last-activity column cell renders formatted date when lastActivity exists", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const lastActivityColumn = columns.find(
      (col) => col.id === "last-activity",
    );

    expect(lastActivityColumn).toBeDefined();
    if (
      lastActivityColumn &&
      "cell" in lastActivityColumn &&
      typeof lastActivityColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: mockTeamMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      const { container } = render(
        <>{lastActivityColumn.cell(mockCellContext)}</>,
      );
      expect(container.textContent).toBeTruthy();
      expect(container.textContent).not.toBe("-");
    }
  });

  it("last-activity column cell renders '-' when lastActivity is null", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser);
    const lastActivityColumn = columns.find(
      (col) => col.id === "last-activity",
    );

    const memberWithoutActivity: TeamMemberRow = {
      ...mockTeamMember,
      lastActivity: null,
    };

    expect(lastActivityColumn).toBeDefined();
    if (
      lastActivityColumn &&
      "cell" in lastActivityColumn &&
      typeof lastActivityColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: memberWithoutActivity, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      const { container } = render(
        <>{lastActivityColumn.cell(mockCellContext)}</>,
      );
      expect(container.textContent).toBe("-");
    }
  });

  it("does not include actions column when isManager is false", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser, false);
    const actionsColumn = columns.find((col) => col.id === "actions");
    expect(actionsColumn).toBeUndefined();
  });

  it("includes actions column when isManager is true", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser, true);
    const actionsColumn = columns.find((col) => col.id === "actions");
    expect(actionsColumn).toBeDefined();
    expect(actionsColumn?.enableSorting).toBe(false);
  });

  it("includes actions column when isSupervisor is true", () => {
    const columns = getTeamMembersColumns(
      mockOnRemoveUser,
      false,
      false,
      "team-1",
      undefined,
      0,
      true,
    );
    const actionsColumn = columns.find((col) => col.id === "actions");
    expect(actionsColumn).toBeDefined();
    expect(actionsColumn?.enableSorting).toBe(false);
  });

  it("does not include actions column when neither manager nor admin nor supervisor", () => {
    const columns = getTeamMembersColumns(
      mockOnRemoveUser,
      false,
      false,
      "team-1",
      undefined,
      0,
      false,
    );
    const actionsColumn = columns.find((col) => col.id === "actions");
    expect(actionsColumn).toBeUndefined();
  });

  it("actions column cell shows 'Renvoyer l'invitation' option for pending users", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser, true);
    const actionsColumn = columns.find((col) => col.id === "actions");

    const pendingMember: TeamMemberRow = {
      ...mockTeamMember,
      id: "pending-1",
      isPending: true,
      roleLabel: "",
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: pendingMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      render(<>{actionsColumn.cell(mockCellContext)}</>);
      const trigger = screen.getByRole("button", { name: /Actions pour/i });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(
        screen.getByRole("button", { name: /Renvoyer l'invitation/i }),
      ).toBeInTheDocument();
    }
  });

  it("actions column cell does not show 'Renvoyer l'invitation' for non-pending users", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser, true);
    const actionsColumn = columns.find((col) => col.id === "actions");

    const regularMember: TeamMemberRow = {
      ...mockTeamMember,
      isPending: false,
      roleLabel: "",
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: regularMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      render(<>{actionsColumn.cell(mockCellContext)}</>);
      fireEvent.click(screen.getByRole("button", { name: /Actions pour/i }));
      expect(
        screen.queryByRole("button", { name: /Renvoyer l'invitation/i }),
      ).not.toBeInTheDocument();
    }
  });

  it("actions column cell returns null for admin users", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser, true);
    const actionsColumn = columns.find((col) => col.id === "actions");

    const adminMember: TeamMemberRow = {
      ...mockTeamMember,
      roleLabel: USER_ROLES.ADMIN,
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: adminMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      const { container } = render(<>{actionsColumn.cell(mockCellContext)}</>);
      expect(container.firstChild).toBeNull();
    }
  });

  it("actions column cell renders action select for manager users when there are multiple managers", () => {
    // Pass managersCount = 2 to allow removing this manager
    const columns = getTeamMembersColumns(
      mockOnRemoveUser,
      true,
      false,
      "team-1",
      undefined,
      2,
    );
    const actionsColumn = columns.find((col) => col.id === "actions");

    const managerMember: TeamMemberRow = {
      ...mockTeamMember,
      roleLabel: TeamRole.MANAGER,
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: managerMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      render(<>{actionsColumn.cell(mockCellContext)}</>);
      fireEvent.click(screen.getByRole("button", { name: /Actions pour/i }));
      expect(
        screen.getByRole("button", { name: /Enlever le rôle de responsable/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Retirer de l'équipe/i }),
      ).toBeInTheDocument();
    }
  });

  it("actions column cell shows message for last manager (cannot be removed)", () => {
    // Pass managersCount = 1 to prevent removing the last manager
    const columns = getTeamMembersColumns(
      mockOnRemoveUser,
      true,
      false,
      "team-1",
      undefined,
      1,
    );
    const actionsColumn = columns.find((col) => col.id === "actions");

    const managerMember: TeamMemberRow = {
      ...mockTeamMember,
      roleLabel: TeamRole.MANAGER,
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: managerMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      render(<>{actionsColumn.cell(mockCellContext)}</>);
      expect(screen.getByText(/Unique responsable/i)).toBeInTheDocument();
      expect(screen.getByText(/ne peut être supprimé/i)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Actions pour/i }),
      ).not.toBeInTheDocument();
    }
  });

  it("actions column cell renders action select for regular users", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser, true);
    const actionsColumn = columns.find((col) => col.id === "actions");

    const regularUserMember: TeamMemberRow = {
      ...mockTeamMember,
      roleLabel: "",
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: regularUserMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      render(<>{actionsColumn.cell(mockCellContext)}</>);
      fireEvent.click(screen.getByRole("button", { name: /Actions pour/i }));
      expect(
        screen.getByRole("button", { name: /Définir comme responsable/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Retirer de l'équipe/i }),
      ).toBeInTheDocument();
    }
  });

  it("allows keyboard navigation between actions with arrow keys when the menu is open", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser, true);
    const actionsColumn = columns.find((col) => col.id === "actions");

    const regularUserMember: TeamMemberRow = {
      ...mockTeamMember,
      roleLabel: "",
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: regularUserMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      render(<>{actionsColumn.cell(mockCellContext)}</>);
      const trigger = screen.getByRole("button", { name: /Actions pour/i });

      // Ouverture du menu : le focus passe sur le premier élément.
      fireEvent.click(trigger);
      const firstItem = screen.getByRole("button", {
        name: /Définir comme responsable/i,
      });
      const lastItem = screen.getByRole("button", {
        name: /Retirer de l'équipe/i,
      });
      expect(firstItem).toHaveFocus();

      // Flèche bas : élément suivant.
      fireEvent.keyDown(firstItem, { key: "ArrowDown" });
      expect(lastItem).toHaveFocus();

      // Flèche bas en fin de liste : bouclage vers le premier.
      fireEvent.keyDown(lastItem, { key: "ArrowDown" });
      expect(firstItem).toHaveFocus();

      // Flèche haut : bouclage vers le dernier.
      fireEvent.keyDown(firstItem, { key: "ArrowUp" });
      expect(lastItem).toHaveFocus();

      // End / Home.
      fireEvent.keyDown(lastItem, { key: "Home" });
      expect(firstItem).toHaveFocus();
      fireEvent.keyDown(firstItem, { key: "End" });
      expect(lastItem).toHaveFocus();

      // Échap : ferme le menu et rend le focus au bouton.
      fireEvent.keyDown(lastItem, { key: "Escape" });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
    }
  });

  it("opens the menu with ArrowDown and focuses the first option (not the second)", () => {
    const columns = getTeamMembersColumns(mockOnRemoveUser, true);
    const actionsColumn = columns.find((col) => col.id === "actions");

    const regularUserMember: TeamMemberRow = {
      ...mockTeamMember,
      roleLabel: "",
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: regularUserMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      render(<>{actionsColumn.cell(mockCellContext)}</>);
      const trigger = screen.getByRole("button", { name: /Actions pour/i });

      // Ouverture via la flèche bas : le focus va sur la PREMIÈRE option.
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      const firstItem = screen.getByRole("button", {
        name: /Définir comme responsable/i,
      });
      expect(firstItem).toHaveFocus();

      // Un keydown répété (touche maintenue) ne doit pas avancer vers l'option 2.
      fireEvent.keyDown(firstItem, { key: "ArrowDown", repeat: true });
      expect(firstItem).toHaveFocus();
    }
  });

  it("actions column cell returns null when manager tries to manage themselves (with multiple managers)", () => {
    const currentUserId = "user-1";
    // Pass managersCount = 2 so the "last manager" message doesn't appear
    const columns = getTeamMembersColumns(
      mockOnRemoveUser,
      true,
      false,
      "team-1",
      currentUserId,
      2,
    );
    const actionsColumn = columns.find((col) => col.id === "actions");

    const managerMember: TeamMemberRow = {
      ...mockTeamMember,
      id: currentUserId,
      roleLabel: TeamRole.MANAGER,
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: managerMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      const { container } = render(<>{actionsColumn.cell(mockCellContext)}</>);
      expect(container.firstChild).toBeNull();
    }
  });

  it("actions column cell shows last manager message even when it's current user", () => {
    const currentUserId = "user-1";
    // Pass managersCount = 1 so the "last manager" message appears
    const columns = getTeamMembersColumns(
      mockOnRemoveUser,
      true,
      false,
      "team-1",
      currentUserId,
      1,
    );
    const actionsColumn = columns.find((col) => col.id === "actions");

    const managerMember: TeamMemberRow = {
      ...mockTeamMember,
      id: currentUserId,
      roleLabel: TeamRole.MANAGER,
    };

    expect(actionsColumn).toBeDefined();
    if (
      actionsColumn &&
      "cell" in actionsColumn &&
      typeof actionsColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: managerMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;

      render(<>{actionsColumn.cell(mockCellContext)}</>);
      // Should show the "last manager" message, not null
      expect(screen.getByText(/Unique responsable/i)).toBeInTheDocument();
    }
  });

  describe("resend invitation callbacks", () => {
    const pendingMember: TeamMemberRow = {
      ...mockTeamMember,
      id: "pending-1",
      isPending: true,
      roleLabel: "",
    };

    function makeCellContext() {
      return {
        row: { original: pendingMember, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<TeamMemberRow, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<TeamMemberRow, unknown>["cell"],
        table: {} as CellContext<TeamMemberRow, unknown>["table"],
      } as CellContext<TeamMemberRow, unknown>;
    }

    it("wires onError to invalidate the team query and surface the message", () => {
      const onResendError = jest.fn();
      const columns = getTeamMembersColumns(
        mockOnRemoveUser,
        true, // isManager
        false, // isAdmin
        "team-1", // teamId
        undefined, // currentUserId
        0, // managersCount
        false, // isSupervisor
        undefined, // onResendSuccess
        onResendError,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");

      expect(actionsColumn).toBeDefined();
      if (
        actionsColumn &&
        "cell" in actionsColumn &&
        typeof actionsColumn.cell === "function"
      ) {
        render(<>{actionsColumn.cell(makeCellContext())}</>);

        // Le composant câble onError dans les options de la mutation. On
        // récupère ce callback et on simule l'échec serveur (409 orphelin).
        const lastCall = mockResendMutationOptions.mock.calls.at(-1) as
          | [ResendMutationOptions]
          | undefined;
        const options = lastCall?.[0];
        expect(options?.onError).toBeDefined();
        options!.onError!(new Error("Cette personne a déjà un compte."));

        expect(mockUseQueryClient().invalidateQueries).toHaveBeenCalled();
        expect(onResendError).toHaveBeenCalledWith(
          "Cette personne a déjà un compte.",
        );
      }
    });

    it("wires onSuccess to surface the success callback", () => {
      const onResendSuccess = jest.fn();
      const columns = getTeamMembersColumns(
        mockOnRemoveUser,
        true, // isManager
        false, // isAdmin
        "team-1", // teamId
        undefined, // currentUserId
        0, // managersCount
        false, // isSupervisor
        onResendSuccess,
      );
      const actionsColumn = columns.find((col) => col.id === "actions");

      expect(actionsColumn).toBeDefined();
      if (
        actionsColumn &&
        "cell" in actionsColumn &&
        typeof actionsColumn.cell === "function"
      ) {
        render(<>{actionsColumn.cell(makeCellContext())}</>);

        const lastCall = mockResendMutationOptions.mock.calls.at(-1) as
          | [ResendMutationOptions]
          | undefined;
        const options = lastCall?.[0];
        expect(options?.onSuccess).toBeDefined();
        options!.onSuccess!();

        expect(onResendSuccess).toHaveBeenCalled();
      }
    });
  });
});

describe("RemoveUserModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
  });

  it("does not request the removal preview while the modal is closed", () => {
    render(
      <RemoveUserModal
        userEmail="john.doe@example.com"
        onRemoveUser={jest.fn()}
        userId="user-1"
        teamId="team-1"
      />,
    );

    expect(mockUseQuery).not.toHaveBeenCalled();
    expect(screen.queryByText(/Chargement de l'aperçu/i)).toBeNull();
  });

  it("requests the removal preview once the modal is disclosed", () => {
    const { container } = render(
      <RemoveUserModal
        userEmail="john.doe@example.com"
        onRemoveUser={jest.fn()}
        userId="user-1"
        teamId="team-1"
      />,
    );

    act(() => {
      container
        .querySelector("dialog")
        ?.dispatchEvent(new Event("dsfr.disclose"));
    });

    expect(mockUseQuery).toHaveBeenCalled();
    expect(screen.getByText(/Chargement de l'aperçu/i)).toBeInTheDocument();
  });
});

describe("RemovalDebugPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state when fetching data", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<RemovalDebugPreview userId="user-1" teamId="team-1" />);
    expect(screen.getByText(/Chargement de l'aperçu/i)).toBeInTheDocument();
  });

  it("renders nothing when no data is returned", () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });

    const { container } = render(
      <RemovalDebugPreview userId="user-1" teamId="team-1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows message when no scenarios are affected", () => {
    mockUseQuery.mockReturnValue({
      data: { scenarios: [] },
      isLoading: false,
    });

    render(<RemovalDebugPreview userId="user-1" teamId="team-1" />);
    expect(
      screen.getByText(/Aucun signalement actif affecté/i),
    ).toBeInTheDocument();
  });

  it("shows summary with transfer count", () => {
    mockUseQuery.mockReturnValue({
      data: {
        scenarios: [
          {
            type: "AUTHOR_TRANSFER",
            reportId: "report-1",
            reportSubject: "Test Report",
            reportApplicant: "Jane Doe",
            newAuthor: "Bob Smith",
          },
        ],
      },
      isLoading: false,
    });

    render(<RemovalDebugPreview userId="user-1" teamId="team-1" />);
    expect(
      screen.getByText(/1 signalement\(s\) transféré\(s\)/i),
    ).toBeInTheDocument();
  });

  it("shows summary with close count", () => {
    mockUseQuery.mockReturnValue({
      data: {
        scenarios: [
          {
            type: "AUTHOR_ALONE_CLOSE",
            reportId: "report-1",
            reportSubject: "Test Report",
            reportApplicant: "Jane Doe",
          },
        ],
      },
      isLoading: false,
    });

    render(<RemovalDebugPreview userId="user-1" teamId="team-1" />);
    expect(
      screen.getByText(/1 signalement\(s\) clôturé\(s\)/i),
    ).toBeInTheDocument();
  });

  it("shows summary with notification count", () => {
    mockUseQuery.mockReturnValue({
      data: {
        scenarios: [
          {
            type: "COAUTHOR_ONLY",
            reportId: "report-1",
            reportSubject: "Test Report",
            reportApplicant: "Jane Doe",
          },
        ],
      },
      isLoading: false,
    });

    render(<RemovalDebugPreview userId="user-1" teamId="team-1" />);
    expect(
      screen.getByText(/1 notification\(s\) envoyée\(s\)/i),
    ).toBeInTheDocument();
  });

  it("shows summary with revert count", () => {
    mockUseQuery.mockReturnValue({
      data: {
        scenarios: [
          {
            type: "RECIPIENT_HANDLED_REVERT",
            reportId: "report-1",
            reportSubject: "Test Report",
            reportApplicant: "Jane Doe",
          },
        ],
      },
      isLoading: false,
    });

    render(<RemovalDebugPreview userId="user-1" teamId="team-1" />);
    expect(
      screen.getByText(/1 signalement\(s\) remis en attente/i),
    ).toBeInTheDocument();
  });

  it("shows detailed scenario list with report subjects", () => {
    mockUseQuery.mockReturnValue({
      data: {
        scenarios: [
          {
            type: "AUTHOR_TRANSFER",
            reportId: "report-1",
            reportSubject: "Problem with taxes",
            reportApplicant: "Jane Doe",
            newAuthor: "Bob Smith",
          },
        ],
      },
      isLoading: false,
    });

    render(<RemovalDebugPreview userId="user-1" teamId="team-1" />);
    expect(screen.getByText("Problem with taxes")).toBeInTheDocument();
    expect(screen.getByText(/Usager : Jane Doe/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Smith/i)).toBeInTheDocument();
  });
});
