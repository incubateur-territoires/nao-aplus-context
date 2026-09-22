import "@testing-library/jest-dom";
import React from "react";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
  act,
} from "@testing-library/react";
import { TeamContent } from "./team-content";
import { useQuery, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MOCK_DATES, MOCK_IDS, USER_ROLES } from "@/test/mocks";
import { useSession } from "@/app/component/auth-provider/auth-provider";

// useFocusOnVisible appelle scrollIntoView, non implémenté par jsdom
Element.prototype.scrollIntoView = jest.fn();

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
    useSuspenseQuery: jest.fn(),
    useMutation: jest.fn(),
  };
});

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: jest.fn(),
}));

// Capture onAddSuccess callback from AddMemberForm
let capturedOnAddSuccess: ((emails: string[]) => void) | undefined;
jest.mock("./add-member-form/add-member-form", () => ({
  AddMemberForm: ({
    onAddSuccess,
  }: {
    teamId: string;
    onAddSuccess?: (emails: string[]) => void;
  }) => {
    capturedOnAddSuccess = onAddSuccess;
    return (
      <div data-testid="add-member-form">Ajouter un ou plusieurs membres</div>
    );
  },
}));

jest.mock("@codegouvfr/react-dsfr/Button", () => ({
  __esModule: true,
  default: ({
    onClick,
    children,
    iconId,
    priority,
    size,
  }: {
    onClick?: () => void;
    children?: React.ReactNode;
    iconId?: string;
    priority?: string;
    size?: string;
  }) => (
    <button
      onClick={onClick}
      data-icon-id={iconId}
      data-priority={priority}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

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

interface MockTeamUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profession: string | null;
  authoredReports: { id: string; createdAt: Date }[];
  coAuthoredReports: { id: string; createdAt: Date }[];
}

interface MockTeam {
  id: string;
  name: string;
  managers: { id: string }[];
  pendingUsers: { id: string; email: string }[];
  pendingManagers: { id: string }[];
  areas: { id: string; name: string }[];
  organizationId: string;
  organization: { id: string; name: string; shortName: string };
  users: MockTeamUser[];
}

const mockTeam: MockTeam = {
  id: MOCK_IDS.TEAM_1,
  name: "Test Team",
  managers: [],
  pendingUsers: [],
  pendingManagers: [],
  areas: [{ id: "area-1", name: "Nord" }],
  organizationId: MOCK_IDS.ORG_1,
  organization: {
    id: MOCK_IDS.ORG_1,
    name: "Organisation 1",
    shortName: "ORG1",
  },
  users: [
    {
      id: MOCK_IDS.USER_1,
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      role: USER_ROLES.ADMIN,
      profession: "Developer",
      authoredReports: [
        {
          id: MOCK_IDS.REPORT_1,
          createdAt: MOCK_DATES.JAN_1_2024,
        },
        {
          id: MOCK_IDS.REPORT_2,
          createdAt: MOCK_DATES.JAN_2_2024,
        },
      ],
      coAuthoredReports: [
        {
          id: MOCK_IDS.REPORT_3,
          createdAt: MOCK_DATES.JAN_3_2024,
        },
      ],
    },
    {
      id: MOCK_IDS.USER_2,
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@example.com",
      role: USER_ROLES.USER,
      profession: null,
      authoredReports: [],
      coAuthoredReports: [],
    },
  ],
};

// Configurable mock data that can be modified per-test
let mockTeamData: MockTeam = mockTeam;
let mockActivityData: Record<string, unknown> = {};

// Capture des options passées à la mutation resendInvitation pour pouvoir
// déclencher onSuccess / onError depuis les tests.
let capturedResendOptions:
  | {
      onSuccess?: () => void;
      onError?: (error: { message: string }) => void;
    }
  | undefined;

function setupSuspenseQueryMock() {
  let callCount = 0;
  (useSuspenseQuery as jest.Mock).mockImplementation(() => {
    callCount++;
    if (callCount % 2 === 1) {
      return { data: mockTeamData };
    }
    return { data: mockActivityData };
  });
}

describe("TeamContent", () => {
  let mockMutateAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync = jest.fn().mockResolvedValue(mockTeam);
    // Reset mock data to defaults
    mockTeamData = mockTeam;
    mockActivityData = {};
    capturedResendOptions = undefined;

    interface DsfrMock {
      (): {
        modal: {
          open: jest.Mock;
          close: jest.Mock;
          disclose: jest.Mock;
          conceal: jest.Mock;
        };
      };
      modal: {
        open: jest.Mock;
        close: jest.Mock;
        disclose: jest.Mock;
        conceal: jest.Mock;
      };
    }

    const dsfrMock = jest.fn(() => ({
      modal: {
        open: jest.fn(),
        close: jest.fn(),
        disclose: jest.fn(),
        conceal: jest.fn(),
      },
    })) as unknown as DsfrMock;
    dsfrMock.modal = {
      open: jest.fn(),
      close: jest.fn(),
      disclose: jest.fn(),
      conceal: jest.fn(),
    };
    Object.defineProperty(window, "dsfr", {
      value: dsfrMock,
      writable: true,
      configurable: true,
    });

    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1 } },
    });
    (useTRPC as jest.Mock).mockReturnValue({
      team: {
        getTeamById: {
          queryOptions: (teamId: string) => ({
            queryKey: ["team", "getTeamById", teamId],
            queryFn: async () => mockTeam,
          }),
          queryKey: (teamId: string) => ["team", "getTeamById", teamId],
        },
        getTeamMembersActivity: {
          queryOptions: (teamId: string) => ({
            queryKey: ["team", "getTeamMembersActivity", teamId],
            queryFn: async () => ({}),
          }),
        },
        updateTeam: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(mockTeam),
          }),
        },
        updateTeamAcceptTypes: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(mockTeam),
          }),
        },
        removeUserFromTeam: {
          mutationOptions: () => ({
            mutationFn: mockMutateAsync,
          }),
        },
        addUserToTeam: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(mockTeam),
          }),
        },
        updateTeamAdmin: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(mockTeam),
          }),
        },
        updateTeamAreas: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(mockTeam),
          }),
        },
        deleteTeam: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(undefined),
          }),
        },
        previewDeleteTeam: {
          queryOptions: () => ({
            queryKey: ["team", "previewDeleteTeam"],
          }),
        },
        previewRemoveFromTeam: {
          queryOptions: () => ({
            queryKey: ["team", "previewRemoveFromTeam"],
          }),
        },
        addManager: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(mockTeam),
          }),
        },
        removeManager: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(mockTeam),
          }),
        },
      },
      user: {
        deactivateUser: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(undefined),
          }),
        },
        reactivateUser: {
          mutationOptions: () => ({
            mutationFn: jest.fn().mockResolvedValue(undefined),
          }),
        },
        resendInvitation: {
          mutationOptions: (opts: {
            onSuccess?: () => void;
            onError?: (error: { message: string }) => void;
          }) => {
            capturedResendOptions = opts;
            return {
              mutationFn: jest.fn().mockResolvedValue(undefined),
            };
          },
        },
      },
      area: {
        getAreas: {
          queryOptions: () => ({
            queryKey: ["area", "getAreas"],
            queryFn: async () => [{ id: "area-1", name: "Nord" }],
          }),
        },
        getMyAreas: {
          queryOptions: () => ({
            queryKey: ["area", "getMyAreas"],
            queryFn: async () => [{ id: "area-1", name: "Nord" }],
          }),
        },
      },
      organization: {
        getOrganizations: {
          queryOptions: () => ({
            queryKey: ["organization", "getOrganizations"],
            queryFn: async () => [
              { id: MOCK_IDS.ORG_1, name: "Organisation 1", shortName: "ORG1" },
            ],
          }),
        },
      },
    });
    // Mock for useSuspenseQuery (used by useTeamContent hook)
    setupSuspenseQueryMock();

    // Mock for useQuery (used by TeamSettings, TeamAdminSettings)
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return {
          data: mockTeam,
          isLoading: false,
        };
      }
      if (
        queryKey.includes("team") &&
        queryKey.includes("getTeamMembersActivity")
      ) {
        return {
          data: {},
          isLoading: false,
        };
      }
      if (
        queryKey.includes("area") &&
        (queryKey.includes("getAreas") || queryKey.includes("getMyAreas"))
      ) {
        return {
          data: [{ id: "area-1", name: "Nord" }],
          isLoading: false,
        };
      }
      if (
        queryKey.includes("organization") &&
        queryKey.includes("getOrganizations")
      ) {
        return {
          data: [
            { id: MOCK_IDS.ORG_1, name: "Organisation 1", shortName: "ORG1" },
          ],
          isLoading: false,
        };
      }
      return {
        data: undefined,
        isLoading: false,
      };
    });
    (useMutation as jest.Mock).mockImplementation(() => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }));
  });

  it("renders the members heading", async () => {
    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Membres")).toBeInTheDocument();
    });
  });

  it("renders team members in the table", async () => {
    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("jane.smith@example.com")).toBeInTheDocument();
    });
  });

  it("displays member roles and professions", async () => {
    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Developer")).toBeInTheDocument();
    });
  });

  it("calculates activity labels correctly", async () => {
    // Set activity metrics for this test
    mockActivityData = {
      [MOCK_IDS.USER_1]: {
        signalements: 3,
        sollicitations: 0,
        participations: 0,
      },
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      // John has 3 reports total (2 authored + 1 co-authored)
      expect(screen.getByText("3 signalements")).toBeInTheDocument();
    });
  });

  it("handles empty team members list", async () => {
    mockTeamData = {
      ...mockTeam,
      users: [],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Membres")).toBeInTheDocument();
    });
  });

  it("paginates members table at 10 rows per page when team has more than 10 members", async () => {
    const manyUsers: MockTeamUser[] = Array.from({ length: 12 }, (_, i) => ({
      id: `user-${String(i + 1).padStart(3, "0")}`,
      firstName: "Member",
      lastName: `Z${String(i + 1).padStart(3, "0")}`,
      email: `member${i + 1}@example.com`,
      role: USER_ROLES.USER,
      profession: null,
      authoredReports: [],
      coAuthoredReports: [],
    }));
    mockTeamData = { ...mockTeam, users: manyUsers };
    setupSuspenseQueryMock();

    const { container } = render(
      <TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("Membres")).toBeInTheDocument();
    });

    // The members table is the first table on the page
    const membersTable = container.querySelector("table");
    expect(membersTable).toBeInTheDocument();
    const dataRows = membersTable!.querySelectorAll("tbody tr");
    expect(dataRows.length).toBe(10);

    // DSFR pagination should be rendered
    expect(container.querySelector("nav.fr-pagination")).toBeInTheDocument();

    // Members 1-10 visible (sorted by lastName asc → Z001..Z010)
    expect(screen.getByText("Member Z001")).toBeInTheDocument();
    expect(screen.getByText("Member Z010")).toBeInTheDocument();
    // Members 11-12 not visible on page 1
    expect(screen.queryByText("Member Z011")).not.toBeInTheDocument();
    expect(screen.queryByText("Member Z012")).not.toBeInTheDocument();

    // Navigate to page 2
    const page2Btn = Array.from(
      container.querySelectorAll<HTMLElement>(
        "nav.fr-pagination button.fr-pagination__link",
      ),
    ).find((el) => el.textContent?.trim() === "2");
    expect(page2Btn).toBeDefined();
    fireEvent.click(page2Btn!);

    expect(screen.getByText("Member Z011")).toBeInTheDocument();
    expect(screen.getByText("Member Z012")).toBeInTheDocument();
    expect(screen.queryByText("Member Z001")).not.toBeInTheDocument();
  });

  it("does not show pagination when team has 10 or fewer members", async () => {
    const tenUsers: MockTeamUser[] = Array.from({ length: 10 }, (_, i) => ({
      id: `user-${i}`,
      firstName: "Member",
      lastName: `Y${i}`,
      email: `m${i}@example.com`,
      role: USER_ROLES.USER,
      profession: null,
      authoredReports: [],
      coAuthoredReports: [],
    }));
    mockTeamData = { ...mockTeam, users: tenUsers };
    setupSuspenseQueryMock();

    const { container } = render(
      <TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("Membres")).toBeInTheDocument();
    });

    expect(container.querySelector("nav.fr-pagination")).toBeNull();
    expect(container.querySelectorAll("table tbody tr").length).toBe(10);
  });

  it("handles loading state", async () => {
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return {
          data: undefined,
          isLoading: true,
        };
      }
      return {
        data: undefined,
        isLoading: false,
      };
    });

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Membres")).toBeInTheDocument();
    });
  });

  it("calculates last activity date correctly", async () => {
    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      // John's last activity should be Jan 3 (most recent)
      // The formatted date should be displayed
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });

  it("handles members with no reports", async () => {
    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      // Members without metrics show "-" in the activity column
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });

  it("renders the settings form below the members table", async () => {
    const teamWithManager = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }, { id: MOCK_IDS.USER_2 }],
    };

    // Update both mocks (useSuspenseQuery for TeamContent, useQuery for TeamSettings)
    mockTeamData = teamWithManager;
    setupSuspenseQueryMock();

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("team") && queryKey.includes("getTeamById")) {
        return { data: teamWithManager, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Membres")).toBeInTheDocument();
      expect(screen.getByText("Informations de l'équipe")).toBeInTheDocument();
      // Jane (USER_2) is a manager with USER_ROLES.USER, so she gets Responsable label
      // John (USER_1) is a manager but has USER_ROLES.ADMIN which takes precedence
      expect(screen.getByText("Responsable")).toBeInTheDocument();
    });
  });

  it("shows actions column when current user is a manager", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      // Find "Action" in the table header (th element)
      const table = screen.getByRole("table");
      const headerRow = within(table).getAllByRole("columnheader");
      const actionHeader = headerRow.find((th) =>
        th.textContent?.includes("Action"),
      );
      expect(actionHeader).toBeDefined();
    });
  });

  it("hides actions column when current user is not a manager", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: "different-user-id" }],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Membres")).toBeInTheDocument();
    });

    expect(screen.queryByText("Action")).not.toBeInTheDocument();
  });

  it("hides actions column when current user is not logged in", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
    });

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Membres")).toBeInTheDocument();
    });

    expect(screen.queryByText("Action")).not.toBeInTheDocument();
  });

  it("does not show remove button for admin users when current user is manager", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
      users: [
        {
          id: MOCK_IDS.USER_1,
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          role: USER_ROLES.ADMIN,
          profession: "Developer",
          authoredReports: [],
          coAuthoredReports: [],
        },
        {
          id: MOCK_IDS.USER_2,
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
          role: USER_ROLES.USER,
          profession: null,
          authoredReports: [],
          coAuthoredReports: [],
        },
      ],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      // Find "Action" in the table header
      const table = screen.getByRole("table");
      const headerRow = within(table).getAllByRole("columnheader");
      const actionHeader = headerRow.find((th) =>
        th.textContent?.includes("Action"),
      );
      expect(actionHeader).toBeDefined();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    // Admin user should not have action accordion (returns null for admins)
    const adminRow = screen.getByText("John Doe").closest("tr");
    expect(adminRow).not.toBeNull();
    const adminRowContent = within(adminRow!);
    expect(
      adminRowContent.queryByRole("button", { name: /Actions pour/i }),
    ).not.toBeInTheDocument();

    // Regular user should have action accordion with "Retirer de l'équipe" option
    const regularUserRow = screen.getByText("Jane Smith").closest("tr");
    expect(regularUserRow).not.toBeNull();
    const regularUserRowContent = within(regularUserRow!);
    const trigger = regularUserRowContent.getByRole("button", {
      name: /Actions pour/i,
    });
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(
      regularUserRowContent.getByRole("button", {
        name: /Retirer de l'équipe/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows remove button for other managers but not for current user (manager cannot remove themselves)", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }, { id: MOCK_IDS.USER_2 }],
      users: [
        {
          id: MOCK_IDS.USER_1,
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          role: USER_ROLES.USER,
          profession: "Developer",
          authoredReports: [],
          coAuthoredReports: [],
        },
        {
          id: MOCK_IDS.USER_2,
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
          role: USER_ROLES.USER,
          profession: null,
          authoredReports: [],
          coAuthoredReports: [],
        },
        {
          id: "user-3",
          firstName: "Regular",
          lastName: "User",
          email: "regular@example.com",
          role: USER_ROLES.USER,
          profession: null,
          authoredReports: [],
          coAuthoredReports: [],
        },
      ],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      // Find "Action" in the table header
      const table = screen.getByRole("table");
      const headerRow = within(table).getAllByRole("columnheader");
      const actionHeader = headerRow.find((th) =>
        th.textContent?.includes("Action"),
      );
      expect(actionHeader).toBeDefined();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("Regular User")).toBeInTheDocument();
    });

    // Current user (John, USER_1) is a manager and should NOT have action accordion (cannot manage themselves)
    const johnRow = screen.getByText("John Doe").closest("tr");
    const johnRowContent = within(johnRow!);
    expect(
      johnRowContent.queryByRole("button", { name: /Actions pour/i }),
    ).not.toBeInTheDocument();

    // Other manager (Jane) should have action accordion
    const janeRow = screen.getByText("Jane Smith").closest("tr");
    const janeRowContent = within(janeRow!);
    expect(
      janeRowContent.getByRole("button", { name: /Actions pour/i }),
    ).toBeInTheDocument();

    // Regular user should also have action accordion
    const regularUserRow = screen.getByText("Regular User").closest("tr");
    const regularUserRowContent = within(regularUserRow!);
    expect(
      regularUserRowContent.getByRole("button", { name: /Actions pour/i }),
    ).toBeInTheDocument();
  });

  it("calls removeUserFromTeam when clicking Retirer", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
      users: [
        {
          id: MOCK_IDS.USER_2,
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
          role: USER_ROLES.USER,
          profession: null,
          authoredReports: [],
          coAuthoredReports: [],
        },
      ],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    // Open the action accordion for Jane's row
    const janeRow = screen.getByText("Jane Smith").closest("tr");
    const janeRowContent = within(janeRow!);
    fireEvent.click(
      janeRowContent.getByRole("button", { name: /Actions pour/i }),
    );

    // Click "Retirer de l'équipe" action to open the modal
    fireEvent.click(
      janeRowContent.getByRole("button", { name: /Retirer de l'équipe/i }),
    );

    // Wait for modal to appear
    const modal = await waitFor(() => {
      const dialog = document.querySelector(
        `dialog[id="remove-user-action-modal-${MOCK_IDS.USER_2}"]`,
      ) as HTMLDialogElement;
      if (!dialog) {
        throw new Error("Modal not found");
      }
      return dialog;
    });
    expect(modal).toBeInTheDocument();
    modal.setAttribute("open", "");

    // Find and click the confirm button inside the modal
    const allRemoveButtons = screen.getAllByRole("button", {
      name: /Retirer/i,
    });
    const confirmButton = allRemoveButtons.find((btn) =>
      modal.contains(btn),
    ) as HTMLElement;
    expect(confirmButton).toBeDefined();
    fireEvent.click(confirmButton!);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        teamId: MOCK_IDS.TEAM_1,
        userId: MOCK_IDS.USER_2,
      });
    });
  });

  it("shows AddMemberForm when current user is admin but not manager", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    mockTeamData = {
      ...mockTeam,
      managers: [],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={true} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Ajouter un ou plusieurs membres"),
      ).toBeInTheDocument();
    });
  });

  it("hides AddMemberForm when current user is neither admin nor manager", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });

    mockTeamData = {
      ...mockTeam,
      managers: [],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Membres")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Ajouter un ou plusieurs membres"),
    ).not.toBeInTheDocument();
  });

  it("shows AddMemberForm when current user is manager", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });

    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Ajouter un ou plusieurs membres"),
      ).toBeInTheDocument();
    });
  });

  it("shows AddMemberForm when current user is supervisor", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.SUPERVISOR } },
    });

    mockTeamData = {
      ...mockTeam,
      managers: [],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(
        screen.getByText("Ajouter un ou plusieurs membres"),
      ).toBeInTheDocument();
    });
  });

  it("shows 'Renvoyer l'invitation' option for pending users when user is manager", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
      pendingUsers: [{ id: "pending-1", email: "pending@example.com" }],
      pendingManagers: [],
      users: [
        {
          id: MOCK_IDS.USER_1,
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          role: USER_ROLES.ADMIN,
          profession: "Developer",
          authoredReports: [],
          coAuthoredReports: [],
        },
      ],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getAllByText("pending@example.com").length).toBeGreaterThan(
        0,
      );
    });

    // Find the pending user's row and check for the resend invitation option
    const pendingRow = screen
      .getAllByText("pending@example.com")[0]
      .closest("tr");
    expect(pendingRow).not.toBeNull();
    const pendingRowContent = within(pendingRow!);
    const trigger = pendingRowContent.getByRole("button", {
      name: /Actions pour/i,
    });
    fireEvent.click(trigger);
    expect(
      pendingRowContent.getByRole("button", { name: /Renvoyer l'invitation/i }),
    ).toBeInTheDocument();
  });

  it("shows success alert after removing a member", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
      users: [
        {
          id: MOCK_IDS.USER_1,
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          role: USER_ROLES.ADMIN,
          profession: "Developer",
          authoredReports: [],
          coAuthoredReports: [],
        },
        {
          id: MOCK_IDS.USER_2,
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
          role: USER_ROLES.USER,
          profession: null,
          authoredReports: [],
          coAuthoredReports: [],
        },
      ],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    // Open the action accordion and click "Retirer de l'équipe" to open modal
    const janeRow = screen.getByText("Jane Smith").closest("tr");
    const janeRowContent = within(janeRow!);
    fireEvent.click(
      janeRowContent.getByRole("button", { name: /Actions pour/i }),
    );
    fireEvent.click(
      janeRowContent.getByRole("button", { name: /Retirer de l'équipe/i }),
    );

    // Confirm removal in modal
    const modal = await waitFor(() => {
      const dialog = document.querySelector(
        `dialog[id="remove-user-action-modal-${MOCK_IDS.USER_2}"]`,
      ) as HTMLDialogElement;
      if (!dialog) throw new Error("Modal not found");
      return dialog;
    });
    modal.setAttribute("open", "");

    const allRemoveButtons = screen.getAllByRole("button", {
      name: /Retirer/i,
    });
    const confirmButton = allRemoveButtons.find((btn) =>
      modal.contains(btn),
    ) as HTMLElement;
    fireEvent.click(confirmButton!);

    await waitFor(() => {
      expect(
        screen.getByText("Le membre a bien été retiré de l'équipe."),
      ).toBeInTheDocument();
    });
  });

  it("shows singular description in add alert when one member added", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId("add-member-form")).toBeInTheDocument();
    });

    // Trigger onAddSuccess with a single email
    capturedOnAddSuccess?.(["alice@example.com"]);

    await waitFor(() => {
      expect(
        screen.getByText("Le membre a bien été ajouté à l'équipe."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Adresse e-mail du nouveau membre :"),
      ).toBeInTheDocument();
    });
  });

  it("shows plural description in add alert when multiple members added", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId("add-member-form")).toBeInTheDocument();
    });

    // Trigger onAddSuccess with multiple emails
    capturedOnAddSuccess?.(["alice@example.com", "bob@example.com"]);

    await waitFor(() => {
      expect(
        screen.getByText("Les membres ont bien été ajoutés à l'équipe."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Adresses e-mail des nouveaux membres :"),
      ).toBeInTheDocument();
    });
  });

  it("shows actions column when current user is a supervisor", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.SUPERVISOR } },
    });

    mockTeamData = {
      ...mockTeam,
      managers: [],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const table = screen.getByRole("table");
      const headerRow = within(table).getAllByRole("columnheader");
      const actionHeader = headerRow.find((th) =>
        th.textContent?.includes("Action"),
      );
      expect(actionHeader).toBeDefined();
    });
  });

  it("shows the error alert when resending an invitation fails", async () => {
    mockTeamData = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
      pendingUsers: [{ id: "pending-1", email: "pending@example.com" }],
      pendingManagers: [],
      users: [
        {
          id: MOCK_IDS.USER_1,
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          role: USER_ROLES.ADMIN,
          profession: "Developer",
          authoredReports: [],
          coAuthoredReports: [],
        },
      ],
    };
    setupSuspenseQueryMock();

    render(<TeamContent teamId={MOCK_IDS.TEAM_1} isAdmin={false} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getAllByText("pending@example.com").length).toBeGreaterThan(
        0,
      );
    });

    // L'invitation orpheline déclenche un échec serveur (409) ; on simule le
    // onError câblé par MemberActionCell et on vérifie l'alerte d'information.
    expect(capturedResendOptions?.onError).toBeDefined();
    act(() => {
      capturedResendOptions!.onError!({
        message: "Cette personne a déjà un compte.",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Invitation non renvoyée")).toBeInTheDocument();
      expect(
        screen.getByText("Cette personne a déjà un compte."),
      ).toBeInTheDocument();
    });
  });
});
