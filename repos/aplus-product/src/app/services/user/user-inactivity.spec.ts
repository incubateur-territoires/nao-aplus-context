import { processInactiveUsers } from "./user-inactivity";
import { USER_ROLES, type UserRole } from "@/test/mocks";

// Mock dependencies
const mockSendTemplatedEmail = jest.fn().mockResolvedValue({ success: true });
jest.mock("@/app/services/email/email.service", () => ({
  sendTemplatedEmail: (...args: unknown[]) => mockSendTemplatedEmail(...args),
}));

jest.mock("@/utils/auth-server", () => ({
  revokeUserSessions: jest.fn().mockResolvedValue(undefined),
}));

const mockProcessDeactivationReports = jest
  .fn()
  .mockResolvedValue({ operations: [], scenarios: [] });
jest.mock("./user-deactivation", () => ({
  processDeactivationReports: (...args: unknown[]) =>
    mockProcessDeactivationReports(...args),
}));

const mockFindMostActiveTeamMember = jest
  .fn()
  .mockResolvedValue("most-active-member");
jest.mock("@/utils/report", () => ({
  findMostActiveTeamMember: (...args: unknown[]) =>
    mockFindMostActiveTeamMember(...args),
}));

// Helper to create dates relative to now
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Mock user factory
function createMockUser(overrides: {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  lastActivityAt?: Date | null;
  inactivityWarningsSentAt?: Date[];
  createdAt?: Date;
  teams?: { id: string }[];
  managedTeams?: { id: string }[];
}) {
  return {
    id: overrides.id ?? "user-1",
    email: overrides.email ?? "test@example.com",
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? "User",
    role: overrides.role ?? USER_ROLES.USER,
    lastActivityAt:
      "lastActivityAt" in overrides ? overrides.lastActivityAt! : new Date(),
    inactivityWarningsSentAt: overrides.inactivityWarningsSentAt ?? [],
    createdAt: overrides.createdAt ?? new Date(),
    teams: overrides.teams ?? [],
    managedTeams: overrides.managedTeams ?? [],
    isInactive: null,
  };
}

// Prisma mock type
interface MockPrisma {
  user: {
    findMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  session: {
    deleteMany: jest.Mock;
  };
  team: {
    update: jest.Mock;
  };
  deactivatedUserTeamSnapshot: {
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
}

function createMockPrisma(): MockPrisma {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        teams: [],
        managedTeams: [],
      }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    session: {
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    team: {
      update: jest.fn().mockReturnValue({ _teamUpdate: true }),
    },
    deactivatedUserTeamSnapshot: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

describe("user-inactivity service", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  describe("processInactiveUsers", () => {
    it("should return empty results when no inactive users exist", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await processInactiveUsers(mockPrisma as never);

      expect(result.usersWarned4Months).toEqual([]);
      expect(result.usersWarned5Months).toEqual([]);
      expect(result.usersDeactivated).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("should send first warning at 4 months of inactivity", async () => {
      const user = createMockUser({
        id: "user-4-months",
        email: "inactive4@example.com",
        lastActivityAt: daysAgo(120),
        inactivityWarningsSentAt: [],
      });

      mockPrisma.user.findMany.mockResolvedValue([user]);

      const result = await processInactiveUsers(mockPrisma as never);

      expect(result.usersWarned4Months).toContainEqual({
        id: "user-4-months",
        email: "inactive4@example.com",
      });
      expect(result.usersWarned5Months).toEqual([]);
      expect(result.usersDeactivated).toEqual([]);
      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        "INACTIVITY_WARNING_FIRST",
        expect.objectContaining({
          to: [expect.objectContaining({ email: "inactive4@example.com" })],
        }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-4-months" },
          data: { inactivityWarningsSentAt: { push: expect.any(Date) } },
        }),
      );
    });

    it("should send final warning at 5 months if first warning already sent", async () => {
      const user = createMockUser({
        id: "user-5-months",
        email: "inactive5@example.com",
        lastActivityAt: daysAgo(150),
        inactivityWarningsSentAt: [daysAgo(30)],
      });

      mockPrisma.user.findMany.mockResolvedValue([user]);

      const result = await processInactiveUsers(mockPrisma as never);

      expect(result.usersWarned4Months).toEqual([]);
      expect(result.usersWarned5Months).toContainEqual({
        id: "user-5-months",
        email: "inactive5@example.com",
      });
      expect(result.usersDeactivated).toEqual([]);
      expect(mockSendTemplatedEmail).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-5-months" },
        }),
      );
    });

    it("should deactivate user at 6 months if both warnings sent", async () => {
      const user = createMockUser({
        id: "user-6-months",
        email: "inactive6@example.com",
        lastActivityAt: daysAgo(180),
        inactivityWarningsSentAt: [daysAgo(60), daysAgo(30)],
        teams: [{ id: "team-1" }],
        managedTeams: [],
      });

      mockPrisma.user.findMany.mockResolvedValue([user]);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }],
        managedTeams: [],
      });

      const result = await processInactiveUsers(mockPrisma as never);

      expect(result.usersDeactivated).toContainEqual({
        id: "user-6-months",
        email: "inactive6@example.com",
      });
      expect(result.usersWarned4Months).toEqual([]);
      expect(result.usersWarned5Months).toEqual([]);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        "ACCOUNT_DEACTIVATED_INACTIVITY",
        expect.objectContaining({
          to: [expect.objectContaining({ email: "inactive6@example.com" })],
        }),
      );
    });

    it("should not deactivate user at 6 months if warnings not sent", async () => {
      const user = createMockUser({
        id: "user-6-months-no-warnings",
        email: "no-warnings@example.com",
        lastActivityAt: daysAgo(180),
        inactivityWarningsSentAt: [],
      });

      mockPrisma.user.findMany.mockResolvedValue([user]);

      const result = await processInactiveUsers(mockPrisma as never);

      // Should send first warning instead of deactivating
      expect(result.usersWarned4Months).toContainEqual({
        id: "user-6-months-no-warnings",
        email: "no-warnings@example.com",
      });
      expect(result.usersDeactivated).toEqual([]);
    });

    it("should not send duplicate warnings", async () => {
      const user = createMockUser({
        id: "user-already-warned",
        email: "already-warned@example.com",
        lastActivityAt: daysAgo(130),
        inactivityWarningsSentAt: [daysAgo(10)],
      });

      mockPrisma.user.findMany.mockResolvedValue([user]);

      const result = await processInactiveUsers(mockPrisma as never);

      expect(result.usersWarned4Months).toEqual([]);
      expect(result.usersWarned5Months).toEqual([]);
      expect(result.usersDeactivated).toEqual([]);
      expect(mockSendTemplatedEmail).not.toHaveBeenCalled();
    });

    it("should use createdAt if lastActivityAt is null", async () => {
      const user = createMockUser({
        id: "user-never-logged-in",
        email: "never-logged@example.com",
        lastActivityAt: null,
        createdAt: daysAgo(125),
        inactivityWarningsSentAt: [],
      });

      mockPrisma.user.findMany.mockResolvedValue([user]);

      const result = await processInactiveUsers(mockPrisma as never);

      expect(result.usersWarned4Months).toContainEqual({
        id: "user-never-logged-in",
        email: "never-logged@example.com",
      });
    });

    it("should handle errors gracefully and continue processing", async () => {
      const user1 = createMockUser({
        id: "user-error",
        email: "error@example.com",
        lastActivityAt: daysAgo(120),
        inactivityWarningsSentAt: [],
      });

      const user2 = createMockUser({
        id: "user-success",
        email: "success@example.com",
        lastActivityAt: daysAgo(120),
        inactivityWarningsSentAt: [],
      });

      mockPrisma.user.findMany.mockResolvedValue([user1, user2]);

      // First call fails (user1), second call succeeds (user2)
      mockSendTemplatedEmail
        .mockRejectedValueOnce(new Error("Email error"))
        .mockResolvedValueOnce({ success: true });

      const result = await processInactiveUsers(mockPrisma as never);

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].userId).toBe("user-error");
      expect(result.usersWarned4Months).toContainEqual({
        id: "user-success",
        email: "success@example.com",
      });
    });

    it("should handle non-Error exceptions in error handling", async () => {
      const user = createMockUser({
        id: "user-string-error",
        email: "string-error@example.com",
        lastActivityAt: daysAgo(120),
        inactivityWarningsSentAt: [],
      });

      mockPrisma.user.findMany.mockResolvedValue([user]);
      mockSendTemplatedEmail.mockRejectedValueOnce("string error");

      const result = await processInactiveUsers(mockPrisma as never);

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toBe("string error");
    });

    it("should process multiple users in the same batch", async () => {
      const user4m = createMockUser({
        id: "user-4m",
        email: "4m@example.com",
        lastActivityAt: daysAgo(121),
        inactivityWarningsSentAt: [],
      });
      const user5m = createMockUser({
        id: "user-5m",
        email: "5m@example.com",
        lastActivityAt: daysAgo(151),
        inactivityWarningsSentAt: [daysAgo(30)],
      });
      const user6m = createMockUser({
        id: "user-6m",
        email: "6m@example.com",
        lastActivityAt: daysAgo(181),
        inactivityWarningsSentAt: [daysAgo(60), daysAgo(30)],
        teams: [],
        managedTeams: [],
      });

      mockPrisma.user.findMany.mockResolvedValue([user4m, user5m, user6m]);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [],
        managedTeams: [],
      });

      const result = await processInactiveUsers(mockPrisma as never);

      expect(result.usersWarned4Months).toHaveLength(1);
      expect(result.usersWarned5Months).toHaveLength(1);
      expect(result.usersDeactivated).toHaveLength(1);
    });
  });

  describe("deactivation with manager reassignment", () => {
    function createDeactivatableUser(
      overrides: Partial<ReturnType<typeof createMockUser>> = {},
    ) {
      return createMockUser({
        id: "manager-user",
        email: "manager@example.com",
        lastActivityAt: daysAgo(180),
        inactivityWarningsSentAt: [daysAgo(60), daysAgo(30)],
        teams: [{ id: "team-1" }],
        managedTeams: [{ id: "team-1" }],
        ...overrides,
      });
    }

    it("should reassign manager to most active member when sole manager is deactivated", async () => {
      const user = createDeactivatableUser();

      mockPrisma.user.findMany
        // First call: processInactiveUsers fetches users
        .mockResolvedValueOnce([user])
        // Second call: activeMembers query inside deactivation
        .mockResolvedValueOnce([{ id: "member-a" }, { id: "member-b" }]);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }],
        managedTeams: [{ id: "team-1" }],
      });

      // No other managers
      mockPrisma.user.count.mockResolvedValue(0);

      mockFindMostActiveTeamMember.mockResolvedValue("member-a");

      await processInactiveUsers(mockPrisma as never);

      expect(mockFindMostActiveTeamMember).toHaveBeenCalledWith(
        ["member-a", "member-b"],
        mockPrisma,
      );

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-1" },
        data: { managers: { connect: { id: "member-a" } } },
      });

      // team.update result should be included in the transaction
      const transactionOps = mockPrisma.$transaction.mock.calls[0][0];
      expect(transactionOps).toContainEqual({ _teamUpdate: true });
    });

    it("should not reassign manager when other managers exist", async () => {
      const user = createDeactivatableUser();

      mockPrisma.user.findMany.mockResolvedValueOnce([user]);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }],
        managedTeams: [{ id: "team-1" }],
      });

      // Other managers exist
      mockPrisma.user.count.mockResolvedValue(2);

      await processInactiveUsers(mockPrisma as never);

      expect(mockFindMostActiveTeamMember).not.toHaveBeenCalled();
      expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });

    it("should not reassign manager when no active members remain", async () => {
      const user = createDeactivatableUser();

      mockPrisma.user.findMany
        .mockResolvedValueOnce([user])
        // No active members
        .mockResolvedValueOnce([]);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }],
        managedTeams: [{ id: "team-1" }],
      });

      mockPrisma.user.count.mockResolvedValue(0);

      await processInactiveUsers(mockPrisma as never);

      expect(mockFindMostActiveTeamMember).not.toHaveBeenCalled();
      expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });

    it("should handle multiple managed teams independently", async () => {
      const user = createDeactivatableUser({
        teams: [{ id: "team-1" }, { id: "team-2" }],
        managedTeams: [{ id: "team-1" }, { id: "team-2" }],
      });

      mockPrisma.user.findMany
        .mockResolvedValueOnce([user])
        // team-1: has active members
        .mockResolvedValueOnce([{ id: "member-a" }])
        // team-2: has active members
        .mockResolvedValueOnce([{ id: "member-b" }]);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }, { id: "team-2" }],
        managedTeams: [{ id: "team-1" }, { id: "team-2" }],
      });

      // No other managers for either team
      mockPrisma.user.count.mockResolvedValue(0);

      mockFindMostActiveTeamMember
        .mockResolvedValueOnce("member-a")
        .mockResolvedValueOnce("member-b");

      await processInactiveUsers(mockPrisma as never);

      expect(mockPrisma.team.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-1" },
        data: { managers: { connect: { id: "member-a" } } },
      });
      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-2" },
        data: { managers: { connect: { id: "member-b" } } },
      });
    });

    it("should handle mixed teams: one with other managers, one without", async () => {
      const user = createDeactivatableUser({
        managedTeams: [{ id: "team-1" }, { id: "team-2" }],
      });

      mockPrisma.user.findMany
        .mockResolvedValueOnce([user])
        // team-2: active members (team-1 skipped because it has other managers)
        .mockResolvedValueOnce([{ id: "member-c" }]);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }],
        managedTeams: [{ id: "team-1" }, { id: "team-2" }],
      });

      // team-1 has other managers, team-2 does not
      mockPrisma.user.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      mockFindMostActiveTeamMember.mockResolvedValue("member-c");

      await processInactiveUsers(mockPrisma as never);

      expect(mockPrisma.team.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-2" },
        data: { managers: { connect: { id: "member-c" } } },
      });
    });

    it("should re-fetch user teams from DB for up-to-date state (cascade scenario)", async () => {
      // Simulates: user data loaded with no managedTeams, but another user
      // was promoted to manager in a previous iteration
      const user = createDeactivatableUser({
        managedTeams: [], // stale: no managed teams at load time
      });

      mockPrisma.user.findMany.mockResolvedValueOnce([user]);

      // Fresh DB data shows this user now manages team-1 (assigned in a previous iteration)
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }],
        managedTeams: [{ id: "team-1" }],
      });

      mockPrisma.user.count.mockResolvedValue(0);

      // findMany for active members
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: "member-x" }]);

      mockFindMostActiveTeamMember.mockResolvedValue("member-x");

      await processInactiveUsers(mockPrisma as never);

      // Should have used the fresh DB data, not the stale in-memory data
      expect(mockPrisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "manager-user" },
        select: {
          teams: { select: { id: true } },
          managedTeams: { select: { id: true } },
        },
      });

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-1" },
        data: { managers: { connect: { id: "member-x" } } },
      });
    });

    it("should include snapshot, user update, session delete, reports, and reassignments in transaction", async () => {
      const user = createDeactivatableUser();

      mockPrisma.user.findMany
        .mockResolvedValueOnce([user])
        .mockResolvedValueOnce([{ id: "member-a" }]);

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }],
        managedTeams: [{ id: "team-1" }],
      });

      mockPrisma.user.count.mockResolvedValue(0);
      mockFindMostActiveTeamMember.mockResolvedValue("member-a");

      const mockReportOp = { _reportOp: true };
      mockProcessDeactivationReports.mockResolvedValue({
        operations: [mockReportOp],
        scenarios: [],
      });

      await processInactiveUsers(mockPrisma as never);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const transactionOps = mockPrisma.$transaction.mock.calls[0][0];

      // Should contain: upsert + user.update + session.deleteMany + reportOp + team.update = 5
      expect(transactionOps).toHaveLength(5);
      expect(transactionOps).toContainEqual(mockReportOp);
      expect(transactionOps).toContainEqual({ _teamUpdate: true });
    });

    it("should deactivate user with no managed teams (no reassignment needed)", async () => {
      const user = createDeactivatableUser({
        managedTeams: [],
      });

      mockPrisma.user.findMany.mockResolvedValueOnce([user]);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }],
        managedTeams: [],
      });

      await processInactiveUsers(mockPrisma as never);

      expect(mockPrisma.user.count).not.toHaveBeenCalled();
      expect(mockFindMostActiveTeamMember).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should send deactivation email after transaction", async () => {
      const user = createDeactivatableUser({
        firstName: "Jean",
        lastName: "Dupont",
        managedTeams: [],
      });

      mockPrisma.user.findMany.mockResolvedValueOnce([user]);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [{ id: "team-1" }],
        managedTeams: [],
      });

      await processInactiveUsers(mockPrisma as never);

      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        "ACCOUNT_DEACTIVATED_INACTIVITY",
        expect.objectContaining({
          to: [expect.objectContaining({ email: "manager@example.com" })],
          params: { userFirstName: "Jean" },
        }),
      );
    });

    it("should pass deactivated user name to processDeactivationReports", async () => {
      const user = createDeactivatableUser({
        firstName: "Marie",
        lastName: "Martin",
        managedTeams: [],
      });

      mockPrisma.user.findMany.mockResolvedValueOnce([user]);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        teams: [],
        managedTeams: [],
      });

      await processInactiveUsers(mockPrisma as never);

      expect(mockProcessDeactivationReports).toHaveBeenCalledWith(
        mockPrisma,
        "manager-user",
        "Marie Martin",
        "manager-user",
      );
    });
  });
});
