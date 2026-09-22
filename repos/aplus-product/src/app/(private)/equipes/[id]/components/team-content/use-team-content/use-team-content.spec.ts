import { renderHook, waitFor } from "@testing-library/react";
import { useTeamContent } from "./use-team-content";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { OrganizationRole } from "@/generated/prisma/enums";
import { MOCK_IDS, MOCK_DATES, USER_ROLES } from "@/test/mocks";
import { TeamRole } from "@/types/team";

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useSuspenseQuery: jest.fn(),
    useMutation: jest.fn(),
    useQueryClient: jest.fn(),
  };
});

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: jest.fn(),
}));

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
  role: string;
  managers: { id: string }[];
  pendingUsers: { id: string; email: string }[];
  pendingManagers: { id: string }[];
  users: MockTeamUser[];
}

const mockTeam: MockTeam = {
  id: MOCK_IDS.TEAM_1,
  name: "Test Team",
  role: OrganizationRole.HELPER,
  managers: [],
  pendingUsers: [],
  pendingManagers: [],
  users: [
    {
      id: MOCK_IDS.USER_1,
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      role: USER_ROLES.ADMIN,
      profession: "Developer",
      authoredReports: [
        { id: MOCK_IDS.REPORT_1, createdAt: MOCK_DATES.JAN_1_2024 },
        { id: MOCK_IDS.REPORT_2, createdAt: MOCK_DATES.JAN_2_2024 },
      ],
      coAuthoredReports: [
        { id: MOCK_IDS.REPORT_3, createdAt: MOCK_DATES.JAN_3_2024 },
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

const mockActivityMetrics = {};

function setupSuspenseQueryMock(
  teamData: MockTeam | undefined = mockTeam,
  activityData: Record<string, unknown> = mockActivityMetrics,
) {
  let callCount = 0;
  (useSuspenseQuery as jest.Mock).mockImplementation(() => {
    callCount++;
    // First call is for team, second is for activity metrics
    if (callCount % 2 === 1) {
      return { data: teamData };
    }
    return { data: activityData };
  });
}

describe("useTeamContent", () => {
  let mockMutateAsync: jest.Mock;
  let mockRefetchQueries: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync = jest.fn().mockResolvedValue(mockTeam);
    mockRefetchQueries = jest.fn().mockResolvedValue(undefined);

    (useQueryClient as jest.Mock).mockReturnValue({
      refetchQueries: mockRefetchQueries,
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
        },
        getTeamMembersActivity: {
          queryOptions: (teamId: string) => ({
            queryKey: ["team", "getTeamMembersActivity", teamId],
            queryFn: async () => ({}),
          }),
        },
        removeUserFromTeam: {
          mutationOptions: (options?: { onSuccess?: () => Promise<void> }) => ({
            mutationFn: mockMutateAsync,
            onSuccess: options?.onSuccess,
          }),
        },
      },
      user: {
        deactivateUser: {
          mutationOptions: (options?: { onSuccess?: () => Promise<void> }) => ({
            mutationFn: jest.fn().mockResolvedValue(undefined),
            onSuccess: options?.onSuccess,
          }),
        },
        reactivateUser: {
          mutationOptions: (options?: { onSuccess?: () => Promise<void> }) => ({
            mutationFn: jest.fn().mockResolvedValue(undefined),
            onSuccess: options?.onSuccess,
          }),
        },
      },
    });

    setupSuspenseQueryMock();

    (useMutation as jest.Mock).mockImplementation((options) => ({
      mutateAsync: async (params: { teamId: string; userId: string }) => {
        const result = await mockMutateAsync(params);
        if (options?.onSuccess) {
          await options.onSuccess();
        }
        return result;
      },
      isPending: false,
    }));
  });

  it("returns team data", () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.team).toEqual(mockTeam);
  });

  it("returns isManager as false when user is not a manager", () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.isManager).toBe(false);
  });

  it("returns isManager as true when user is a manager", () => {
    const teamWithManager = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_1 }],
    };

    setupSuspenseQueryMock(teamWithManager);

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.isManager).toBe(true);
  });

  it("returns isAdmin as false when user is not an admin", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.isAdmin).toBe(false);
  });

  it("returns isAdmin as true when user is an admin", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.ADMIN } },
    });

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.isAdmin).toBe(true);
  });

  it("returns isOperatorGroup as false for HELPER teams", () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.isOperatorGroup).toBe(false);
  });

  it("returns isOperatorGroup as true for OPERATOR teams", () => {
    const operatorTeam = {
      ...mockTeam,
      role: OrganizationRole.OPERATOR,
    };

    setupSuspenseQueryMock(operatorTeam);

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.isOperatorGroup).toBe(true);
  });

  it("transforms team users into members with correct data", () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.members).toHaveLength(2);

    const johnMember = result.current.members[0];
    expect(johnMember.id).toBe(MOCK_IDS.USER_1);
    expect(johnMember.fullName).toBe("John Doe");
    expect(johnMember.email).toBe("john.doe@example.com");
    expect(johnMember.profession).toBe("Developer");
    expect(johnMember.isPending).toBe(false);

    const janeMember = result.current.members[1];
    expect(janeMember.id).toBe(MOCK_IDS.USER_2);
    expect(janeMember.fullName).toBe("Jane Smith");
    expect(janeMember.email).toBe("jane.smith@example.com");
    expect(janeMember.profession).toBeNull();
    expect(janeMember.isPending).toBe(false);
  });

  it("calculates activity labels correctly for members with metrics", () => {
    setupSuspenseQueryMock(mockTeam, {
      [MOCK_IDS.USER_1]: {
        signalements: 3,
        sollicitations: 0,
        participations: 0,
      },
    });

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    const johnMember = result.current.members[0];
    expect(johnMember.activityLabels).toContain("3 signalements");
  });

  it("returns empty activity labels for members without metrics", () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    const janeMember = result.current.members[1];
    expect(janeMember.activityLabels).toEqual([]);
  });

  it("calculates last activity date correctly", () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    const johnMember = result.current.members[0];
    expect(johnMember.lastActivity).toEqual(MOCK_DATES.JAN_3_2024);
  });

  it("sets last activity to null for members without reports", () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    const janeMember = result.current.members[1];
    expect(janeMember.lastActivity).toBeNull();
  });

  it("sets roleLabel to ADMIN for admin users", () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    const johnMember = result.current.members[0];
    expect(johnMember.roleLabel).toBe(USER_ROLES.ADMIN);
  });

  it("sets roleLabel to MANAGER for team managers", () => {
    const teamWithManager = {
      ...mockTeam,
      managers: [{ id: MOCK_IDS.USER_2 }],
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

    setupSuspenseQueryMock(teamWithManager);

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.members[0].roleLabel).toBe(TeamRole.MANAGER);
  });

  it("sets empty roleLabel for regular users", () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    const janeMember = result.current.members[1];
    expect(janeMember.roleLabel).toBe("");
  });

  it("transforms pending users into pendingMembers correctly", () => {
    const teamWithPending = {
      ...mockTeam,
      pendingUsers: [
        { id: "pending-1", email: "pending@example.com" },
        { id: "pending-2", email: "pending2@example.com" },
      ],
      pendingManagers: [{ id: "pending-1" }],
    };

    setupSuspenseQueryMock(teamWithPending);

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.pendingMembers).toHaveLength(2);

    const pendingMember1 = result.current.pendingMembers[0];
    expect(pendingMember1.id).toBe("pending-1");
    expect(pendingMember1.fullName).toBe("pending@example.com");
    expect(pendingMember1.email).toBe("pending@example.com");
    expect(pendingMember1.roleLabel).toBe(TeamRole.MANAGER);
    expect(pendingMember1.isPending).toBe(true);

    const pendingMember2 = result.current.pendingMembers[1];
    expect(pendingMember2.roleLabel).toBe("");
    expect(pendingMember2.isPending).toBe(true);
  });

  it("combines members and pendingMembers into data array", () => {
    const teamWithPending = {
      ...mockTeam,
      pendingUsers: [{ id: "pending-1", email: "pending@example.com" }],
      pendingManagers: [],
    };

    setupSuspenseQueryMock(teamWithPending);

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data).toEqual([
      ...result.current.members,
      ...result.current.pendingMembers,
    ]);
  });

  it("returns empty arrays when team is undefined", () => {
    (useSuspenseQuery as jest.Mock).mockReturnValue({
      data: undefined,
    });

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.team).toBeUndefined();
    expect(result.current.members).toEqual([]);
    expect(result.current.pendingMembers).toEqual([]);
    expect(result.current.data).toEqual([]);
    expect(result.current.isManager).toBe(false);
  });

  it("calls removeUserFromTeam mutation when handleRemoveUser is called", async () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    await result.current.handleRemoveUser(MOCK_IDS.USER_2);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      teamId: MOCK_IDS.TEAM_1,
      userId: MOCK_IDS.USER_2,
    });
  });

  it("refetches team data after successful user removal", async () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    await result.current.handleRemoveUser(MOCK_IDS.USER_2);

    await waitFor(() => {
      expect(mockRefetchQueries).toHaveBeenCalled();
    });
  });

  it("returns true when removeUserFromTeam succeeds", async () => {
    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    const success = await result.current.handleRemoveUser(MOCK_IDS.USER_2);

    expect(success).toBe(true);
  });

  it("returns false when removeUserFromTeam fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockMutateAsync.mockRejectedValueOnce(new Error("Failed to remove user"));

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    const success = await result.current.handleRemoveUser(MOCK_IDS.USER_2);

    expect(success).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error removing user from team:",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it("handles member with only authored reports", () => {
    const teamWithAuthorOnly = {
      ...mockTeam,
      users: [
        {
          id: MOCK_IDS.USER_1,
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          role: USER_ROLES.USER,
          profession: "Developer",
          authoredReports: [
            { id: MOCK_IDS.REPORT_1, createdAt: MOCK_DATES.JAN_1_2024 },
          ],
          coAuthoredReports: [],
        },
      ],
    };

    setupSuspenseQueryMock(teamWithAuthorOnly, {
      [MOCK_IDS.USER_1]: {
        signalements: 1,
        sollicitations: 0,
        participations: 0,
      },
    });

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.members[0].activityLabels).toContain("1 signalement");
    expect(result.current.members[0].lastActivity).toEqual(
      MOCK_DATES.JAN_1_2024,
    );
  });

  it("handles member with only co-authored reports", () => {
    const teamWithCoAuthorOnly = {
      ...mockTeam,
      users: [
        {
          id: MOCK_IDS.USER_1,
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          role: USER_ROLES.USER,
          profession: "Developer",
          authoredReports: [],
          coAuthoredReports: [
            { id: MOCK_IDS.REPORT_1, createdAt: MOCK_DATES.JAN_2_2024 },
            { id: MOCK_IDS.REPORT_2, createdAt: MOCK_DATES.JAN_1_2024 },
          ],
        },
      ],
    };

    setupSuspenseQueryMock(teamWithCoAuthorOnly, {
      [MOCK_IDS.USER_1]: {
        signalements: 2,
        sollicitations: 0,
        participations: 0,
      },
    });

    const { result } = renderHook(() =>
      useTeamContent({ teamId: MOCK_IDS.TEAM_1 }),
    );

    expect(result.current.members[0].activityLabels).toContain(
      "2 signalements",
    );
    expect(result.current.members[0].lastActivity).toEqual(
      MOCK_DATES.JAN_2_2024,
    );
  });
});
