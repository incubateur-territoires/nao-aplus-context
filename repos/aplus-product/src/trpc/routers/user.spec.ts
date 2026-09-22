import { createCallerFactory } from "../init";
import { userRouter } from "./user";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ReportStatus, NotificationFrequency } from "@/generated/prisma/enums";
import { createMockUser, MOCK_IDS, MOCK_DATES, USER_ROLES } from "@/test/mocks";
import { revokeUserSessions } from "@/utils/auth-server";

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
      signUpEmail: jest.fn(),
    },
  },
}));

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue(new Headers()),
}));

// auth-server.ts importe "server-only" (non chargeable sous Jest). On mocke le
// module : la révocation des sessions Redis est testée séparément côté lib.
jest.mock("@/utils/auth-server", () => ({
  revokeUserSessions: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/services/email/email.service", () => ({
  sendTemplatedEmail: jest
    .fn()
    .mockResolvedValue({ messageId: "mock-message-id" }),
}));

// Mock next/server to avoid Request/Response polyfill issues in jsdom and
// to capture `after()` callbacks so tests can flush them deterministically.
const afterCallbacks: Array<() => void | Promise<void>> = [];
jest.mock("next/server", () => ({
  after: (cb: () => void | Promise<void>) => {
    afterCallbacks.push(cb);
  },
}));

import { sendTemplatedEmail } from "@/app/services/email/email.service";

jest.mock("@/utils/search", () => ({
  searchWithUnaccent: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    team: {
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
    deactivatedUserTeamSnapshot: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    reportStatusHistory: {
      create: jest.fn(),
    },
    answer: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    supervisor: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    pendingUser: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    pendingSupervisor: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const createCaller = createCallerFactory(userRouter);

const mockTargetUser = {
  id: MOCK_IDS.USER_2,
  email: "jean.dupont@example.com",
  firstName: "Jean",
  role: USER_ROLES.USER,
  isInactive: null,
};

const mockTargetUserWithTeams = {
  email: "jean.dupont@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  teams: [{ id: MOCK_IDS.TEAM_1 }, { id: MOCK_IDS.TEAM_2 }],
  managedTeams: [{ id: MOCK_IDS.TEAM_1 }],
};

const mockSnapshot = {
  id: "snapshot-1",
  userId: MOCK_IDS.USER_2,
  teams: [{ id: MOCK_IDS.TEAM_1 }, { id: MOCK_IDS.TEAM_2 }],
  managedTeams: [{ id: MOCK_IDS.TEAM_1 }],
  createdAt: MOCK_DATES.JAN_1_2024,
};

describe("userRouter", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    afterCallbacks.length = 0;
    // Default $transaction mock: callback form runs the callback with the
    // mocked prisma client as the tx; array form is left to per-test mocks.
    (prisma.$transaction as jest.Mock).mockImplementation((arg) => {
      if (typeof arg === "function") {
        return arg(prisma);
      }
      return Promise.all(arg);
    });
  });

  describe("getCurrentUser", () => {
    const activeUser = {
      id: MOCK_IDS.USER_2,
      email: "jean.dupont@example.com",
      firstName: "Jean",
      lastName: "Dupont",
      role: USER_ROLES.USER,
      lastActivityAt: null,
      teams: [],
    };

    it("met à jour lastActivityAt hors impersonation", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(activeUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(activeUser);

      const caller = createCaller({
        userId: MOCK_IDS.USER_2,
        user: createMockUser({ id: MOCK_IDS.USER_2 }),
        impersonatedBy: null,
      });
      await caller.getCurrentUser();

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_IDS.USER_2 },
          data: expect.objectContaining({
            lastActivityAt: expect.any(Date),
            inactivityWarningsSentAt: [],
          }),
        }),
      );
    });

    it("ne touche jamais lastActivityAt pendant une impersonation", async () => {
      // Sinon un admin en « Aperçu de l'utilisateur » marquerait la cible comme
      // active et remettrait à zéro son cycle d'inactivité.
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(activeUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(activeUser);

      const caller = createCaller({
        userId: MOCK_IDS.USER_2,
        user: createMockUser({ id: MOCK_IDS.USER_2 }),
        impersonatedBy: MOCK_IDS.USER_1,
      });
      await caller.getCurrentUser();

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("deactivateUser", () => {
    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(
        caller.deactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws error when target user is not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.deactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toThrow("Utilisateur non trouvé.");
    });

    it("throws error when trying to deactivate an admin", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockTargetUser,
        role: USER_ROLES.ADMIN,
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(
        caller.deactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toThrow("Impossible de désactiver un administrateur.");
    });

    it("throws error when trying to deactivate yourself", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_1,
        role: USER_ROLES.USER,
        isInactive: null,
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.deactivateUser({ userId: MOCK_IDS.USER_1 }),
      ).rejects.toThrow("Impossible de désactiver votre propre compte.");
    });

    it("throws error when user is already inactive", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(
        caller.deactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toThrow("Ce compte est déjà désactivé.");
    });

    it("throws FORBIDDEN when caller is not admin and not manager of user's team", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
        mockTargetUser,
      ); // target user
      (prisma.team.findFirst as jest.Mock).mockResolvedValueOnce(null); // not a manager of any team containing the user

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.deactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message:
          "Vous devez être administrateur ou manager de l'équipe pour effectuer cette action.",
      });
    });

    it("deactivates user, saves snapshot, and removes from teams when admin", async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      // No affected reports (both author and recipient queries)
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce([]); // recipient reports

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Verify transaction was called with an array of 3 operations (no affected reports)
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(3);
    });

    // Non-régression : la désactivation doit révoquer les sessions Redis
    // (le prisma.session.deleteMany ne vide que Postgres). Sans cet appel, un
    // utilisateur désactivé resterait authentifié jusqu'à expiration du TTL.
    it("revokes the user's Redis sessions on deactivation", async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce([]); // recipient reports

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(revokeUserSessions).toHaveBeenCalledTimes(1);
      expect(revokeUserSessions).toHaveBeenCalledWith(MOCK_IDS.USER_2);
    });

    it("sends deactivation email to the user after successful deactivation", async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce([]); // recipient reports

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
      expect(sendTemplatedEmail).toHaveBeenCalledWith("ACCOUNT_DEACTIVATED", {
        to: [{ email: "jean.dupont@example.com" }],
        params: {
          userFirstName: "Jean",
        },
      });
    });

    it("throws FORBIDDEN when caller is manager of a different team", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
        mockTargetUser,
      ); // target user
      (prisma.team.findFirst as jest.Mock).mockResolvedValueOnce(null); // manager of team that doesn't include target user

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.deactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message:
          "Vous devez être administrateur ou manager de l'équipe pour effectuer cette action.",
      });
    });

    it("deactivates user when caller is supervisor with user in scope", async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      // Supervisor record with matching scope
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "supervisor-1",
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      });

      // User is in scope
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
        id: MOCK_IDS.USER_2,
      });

      // No affected reports
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce([]); // recipient reports

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });
      expect(prisma.supervisor.findUnique).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_1 },
        include: { areas: true, organizations: true },
      });
    });

    it("throws FORBIDDEN when supervisor has no supervisor record", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
        mockTargetUser,
      );

      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(
        caller.deactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Périmètre superviseur introuvable",
      });
    });

    it("throws FORBIDDEN when supervisor and user is out of scope", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
        mockTargetUser,
      );

      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "supervisor-1",
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      });

      // User NOT in scope
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(
        caller.deactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Utilisateur hors de votre périmètre.",
      });
    });

    it("deactivates user when caller is manager of the user's team", async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      // Manager of a team that includes the target user
      (prisma.team.findFirst as jest.Mock).mockResolvedValueOnce({
        id: MOCK_IDS.TEAM_1,
      });

      // No affected reports
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce([]); // recipient reports

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("creates metadata messages for active reports where user is author with co-authors", async () => {
      // Scenario 1: Author with co-authors - only posts message
      const mockReports = [
        {
          id: "report-1",
          authorId: MOCK_IDS.USER_2,
          coAuthors: [{ id: "other-user" }],
          applicantTeam: { users: [] },
        },
        {
          id: "report-2",
          authorId: MOCK_IDS.USER_2,
          coAuthors: [{ id: "another-user" }],
          applicantTeam: { users: [] },
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(mockReports) // author reports
        .mockResolvedValueOnce([]); // recipient reports
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        {},
        {},
        {},
        {},
        {},
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Verify report.findMany was called with correct filter for active statuses (first call for author reports)
      expect(prisma.report.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          status: {
            in: [ReportStatus.PENDING_ASSIGNMENT, ReportStatus.IN_TREATMENT],
          },
          OR: [
            { authorId: MOCK_IDS.USER_2 },
            { coAuthors: { some: { id: MOCK_IDS.USER_2 } } },
          ],
        },
        select: {
          id: true,
          authorId: true,
          coAuthors: { select: { id: true } },
          applicantTeam: {
            select: {
              users: {
                where: {
                  isInactive: null,
                  id: { not: MOCK_IDS.USER_2 },
                },
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      // Transaction should have 3 base operations + 2 answer creates (Scenario 1)
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(5);
    });

    it("creates metadata message with correct content format for author with co-authors", async () => {
      const mockReports = [
        {
          id: "report-1",
          authorId: MOCK_IDS.USER_2,
          coAuthors: [{ id: "other-user" }],
          applicantTeam: { users: [] },
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams (Jean Dupont)

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(mockReports) // author reports
        .mockResolvedValueOnce([]); // recipient reports

      // Capture the transaction calls to verify answer.create parameters
      let capturedTransaction: unknown[] = [];
      (prisma.$transaction as jest.Mock).mockImplementation((operations) => {
        capturedTransaction = operations;
        return Promise.resolve(operations.map(() => ({})));
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      // The 4th operation (index 3) should be the answer.create for Scenario 1
      // Transaction: snapshot create, user update, session delete, answer create
      expect(capturedTransaction).toHaveLength(4);
    });

    it("does not create metadata messages when no active reports exist", async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      // No affected reports (both author and recipient queries)
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce([]); // recipient reports
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      // Transaction should only have 3 base operations (no answer creates)
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(3);
    });

    it("creates simple message when user is co-author only (Scenario 4)", async () => {
      // Scenario 4: User is co-author, not author - posts simple message
      const mockReportsAsCoAuthor = [
        {
          id: "report-coauthor-1",
          authorId: "other-author",
          coAuthors: [{ id: MOCK_IDS.USER_2 }],
          applicantTeam: { users: [] },
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(mockReportsAsCoAuthor) // author reports
        .mockResolvedValueOnce([]); // recipient reports
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Verify the first query (author reports) includes coAuthors check
      expect(prisma.report.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { authorId: MOCK_IDS.USER_2 },
              { coAuthors: { some: { id: MOCK_IDS.USER_2 } } },
            ],
          }),
        }),
      );

      // Transaction should have 3 base operations + 1 answer create (Scenario 4)
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(4);
    });

    it("only queries for active report statuses, not completed or closed", async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockTargetUserWithTeams);

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce([]); // recipient reports
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      // Verify that COMPLETED, CLOSED, and DELETED are NOT in the filter
      const findManyCall = (prisma.report.findMany as jest.Mock).mock
        .calls[0][0];
      const statusFilter = findManyCall.where.status.in;

      expect(statusFilter).toContain(ReportStatus.PENDING_ASSIGNMENT);
      expect(statusFilter).toContain(ReportStatus.IN_TREATMENT);
      expect(statusFilter).not.toContain(ReportStatus.COMPLETED);
      expect(statusFilter).not.toContain(ReportStatus.CLOSED);
      expect(statusFilter).not.toContain(ReportStatus.DELETED);
    });

    it("transfers authorship when author has no co-authors but team has members (Scenario 2)", async () => {
      // Scenario 2: Author without co-authors, team has other active members
      const mockReports = [
        {
          id: "report-1",
          authorId: MOCK_IDS.USER_2, // deactivated user is author
          coAuthors: [], // no co-authors
          applicantTeam: {
            users: [
              { id: "team-member-1", firstName: "Bob", lastName: "Durand" },
              { id: "team-member-2", firstName: "Alice", lastName: "Martin" },
            ],
          },
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(mockReports) // author reports
        .mockResolvedValueOnce([]); // recipient reports

      // Mock findMostActiveTeamMember - answer.groupBy returns answer counts
      (prisma.answer.groupBy as jest.Mock).mockResolvedValue([
        {
          authorId: "team-member-2",
          _count: { _all: 5 },
          _max: { createdAt: new Date("2024-01-15") },
        },
        {
          authorId: "team-member-1",
          _count: { _all: 2 },
          _max: { createdAt: new Date("2024-01-10") },
        },
      ]);

      // New author who receives the reassigned reports
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { email: "alice.martin@example.com", firstName: "Alice" },
      ]);

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        {},
        {},
        {},
        {},
        {},
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Transaction should have: 3 base + report.update + answer.create = 5 operations
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(5);

      // Verify the new author is notified their reports were reassigned
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["team-member-2"] } },
        select: { email: true, firstName: true },
      });
      expect(sendTemplatedEmail).toHaveBeenCalledWith(
        "DEACTIVATION_REPORTS_REASSIGNED",
        {
          to: [{ email: "alice.martin@example.com" }],
          params: {
            userFirstName: "Alice",
            linkUrl: expect.stringContaining("/tous-les-signalements"),
          },
        },
      );

      // Verify answer.groupBy was called to find the most active member
      expect(prisma.answer.groupBy).toHaveBeenCalledWith({
        by: ["authorId"],
        where: {
          authorId: { in: ["team-member-1", "team-member-2"] },
        },
        _count: { _all: true },
        _max: { createdAt: true },
      });
    });

    it("closes report when author is alone in team (Scenario 3)", async () => {
      // Scenario 3: Author alone in team - close report
      const mockReports = [
        {
          id: "report-1",
          authorId: MOCK_IDS.USER_2, // deactivated user is author
          coAuthors: [], // no co-authors
          applicantTeam: {
            users: [], // no other team members
          },
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser) // target user
        .mockResolvedValueOnce(mockTargetUserWithTeams); // user with teams

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(mockReports) // author reports
        .mockResolvedValueOnce([]); // recipient reports
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        {},
        {},
        {},
        {},
        {},
        {},
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Transaction should have: 3 base + report.update + statusHistory.create + answer.create = 6 operations
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(6);
    });

    it("handles null applicantTeam as Scenario 3 (close report)", async () => {
      // Edge case: applicantTeam is null - treat as Scenario 3
      const mockReports = [
        {
          id: "report-1",
          authorId: MOCK_IDS.USER_2,
          coAuthors: [],
          applicantTeam: null,
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockTargetUserWithTeams);

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(mockReports) // author reports
        .mockResolvedValueOnce([]); // recipient reports
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        {},
        {},
        {},
        {},
        {},
        {},
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Transaction should have: 3 base + report.update + statusHistory.create + answer.create = 6 operations
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(6);
    });

    it("handles mixed scenarios across multiple reports", async () => {
      // Multiple reports with different scenarios
      const mockReports = [
        {
          id: "report-with-coauthors",
          authorId: MOCK_IDS.USER_2,
          coAuthors: [{ id: "other-user" }],
          applicantTeam: { users: [] },
        },
        {
          id: "report-as-coauthor",
          authorId: "other-author",
          coAuthors: [{ id: MOCK_IDS.USER_2 }],
          applicantTeam: { users: [] },
        },
        {
          id: "report-alone-in-team",
          authorId: MOCK_IDS.USER_2,
          coAuthors: [],
          applicantTeam: { users: [] },
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockTargetUserWithTeams);

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(mockReports) // author reports
        .mockResolvedValueOnce([]); // recipient reports
      (prisma.$transaction as jest.Mock).mockResolvedValue(Array(10).fill({}));

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Transaction should have:
      // 3 base operations +
      // Scenario 1 (report-with-coauthors): 1 answer.create +
      // Scenario 4 (report-as-coauthor): 1 answer.create +
      // Scenario 3 (report-alone-in-team): 3 operations (report.update + statusHistory.create + answer.create)
      // Total: 3 + 1 + 1 + 3 = 8 operations
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(8);
    });

    it("uses first team member when no activity history exists (Scenario 2 fallback)", async () => {
      const mockReports = [
        {
          id: "report-1",
          authorId: MOCK_IDS.USER_2,
          coAuthors: [],
          applicantTeam: {
            users: [
              { id: "team-member-1", firstName: "Bob", lastName: "Durand" },
              { id: "team-member-2", firstName: "Alice", lastName: "Martin" },
            ],
          },
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockTargetUserWithTeams);

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(mockReports) // author reports
        .mockResolvedValueOnce([]); // recipient reports

      // No activity history - answer.groupBy returns empty
      (prisma.answer.groupBy as jest.Mock).mockResolvedValue([]);

      // New author who receives the reassigned reports (first team member fallback)
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { email: "team.member1@example.com", firstName: "Camille" },
      ]);

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        {},
        {},
        {},
        {},
        {},
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Transaction should still have 5 operations (authorship transfer)
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(5);

      // Fallback new author (first team member) is notified
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["team-member-1"] } },
        select: { email: true, firstName: true },
      });
      expect(sendTemplatedEmail).toHaveBeenCalledWith(
        "DEACTIVATION_REPORTS_REASSIGNED",
        {
          to: [{ email: "team.member1@example.com" }],
          params: {
            userFirstName: "Camille",
            linkUrl: expect.stringContaining("/tous-les-signalements"),
          },
        },
      );
    });

    // Recipient scenarios
    it("posts message when recipient did not handle the report", async () => {
      const mockRecipientReports = [
        {
          id: "recipient-report-1",
          status: ReportStatus.PENDING_ASSIGNMENT,
          requestedTeams: [
            {
              id: MOCK_IDS.TEAM_1,
              users: [{ id: "other-team-member" }], // Other active members
            },
          ],
          statusHistory: [], // User did not handle (no IN_TREATMENT status)
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockTargetUserWithTeams);

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce(mockRecipientReports); // recipient reports

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Transaction should have: 3 base + 1 answer.create = 4 operations
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(4);
    });

    it("reverts report to PENDING_ASSIGNMENT when recipient handled the report", async () => {
      const mockRecipientReports = [
        {
          id: "recipient-report-1",
          status: ReportStatus.IN_TREATMENT,
          requestedTeams: [
            {
              id: MOCK_IDS.TEAM_1,
              users: [{ id: "other-team-member" }], // Other active members
            },
          ],
          statusHistory: [{ id: "status-history-1" }], // User handled (has IN_TREATMENT)
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockTargetUserWithTeams);

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce(mockRecipientReports); // recipient reports

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        {},
        {},
        {},
        {},
        {},
        {},
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Transaction should have: 3 base + report.update + statusHistory.create + answer.create = 6 operations
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(6);
    });

    it("closes report when recipient is alone in their team", async () => {
      const mockRecipientReports = [
        {
          id: "recipient-report-1",
          status: ReportStatus.IN_TREATMENT,
          requestedTeams: [
            {
              id: MOCK_IDS.TEAM_1,
              users: [], // No other active members
            },
          ],
          statusHistory: [], // Doesn't matter - alone in team takes priority
        },
      ];

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTargetUser)
        .mockResolvedValueOnce(mockTargetUserWithTeams);

      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce(mockRecipientReports); // recipient reports

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        {},
        {},
        {},
        {},
        {},
        {},
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });

      // Transaction should have: 3 base + report.update (CLOSED) + statusHistory.create + answer.create = 6 operations
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(6);
    });
  });

  describe("previewSupervisorTransformation", () => {
    const adminCaller = () =>
      createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({ userId: null, user: null });
      await expect(
        caller.previewSupervisorTransformation({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("throws FORBIDDEN when caller is not admin", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.previewSupervisorTransformation({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws when targeting self", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(
        caller.previewSupervisorTransformation({ userId: MOCK_IDS.USER_1 }),
      ).rejects.toThrow("Impossible de transformer votre propre compte.");
    });

    it("returns null when user not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await adminCaller().previewSupervisorTransformation({
        userId: MOCK_IDS.USER_2,
      });
      expect(result).toBeNull();
    });

    it("throws when target user is admin", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.ADMIN,
        isInactive: null,
        teams: [],
        managedTeams: [],
      });

      await expect(
        adminCaller().previewSupervisorTransformation({
          userId: MOCK_IDS.USER_2,
        }),
      ).rejects.toThrow("Impossible de transformer un administrateur.");
    });

    it("throws when target user is already a supervisor", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.SUPERVISOR,
        isInactive: null,
        teams: [],
        managedTeams: [],
      });

      await expect(
        adminCaller().previewSupervisorTransformation({
          userId: MOCK_IDS.USER_2,
        }),
      ).rejects.toThrow("Cet utilisateur est déjà superviseur.");
    });

    it("throws when target user is inactive", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: MOCK_DATES.JAN_1_2024,
        teams: [],
        managedTeams: [],
      });

      await expect(
        adminCaller().previewSupervisorTransformation({
          userId: MOCK_IDS.USER_2,
        }),
      ).rejects.toThrow("Ce compte est désactivé.");
    });

    it("returns enriched scenarios with empty data when user has no teams or reports", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [],
        managedTeams: [],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce([]) // recipient reports
        .mockResolvedValueOnce([]); // report subjects lookup
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await adminCaller().previewSupervisorTransformation({
        userId: MOCK_IDS.USER_2,
      });

      expect(result).toEqual({
        scenarios: [],
        teams: [],
        managedTeams: [],
        managerTransfers: [],
      });
    });

    it("includes manager transfer info when target manages a team alone", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [{ id: MOCK_IDS.TEAM_1, name: "FS Arras" }],
        managedTeams: [{ id: MOCK_IDS.TEAM_1, name: "FS Arras" }],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0); // no other managers
      (prisma.user.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // newAuthorIds lookup
        .mockResolvedValueOnce([
          { id: "user-active", firstName: "Marie", lastName: "Curie" },
        ]); // active members
      (prisma.answer.findMany as jest.Mock).mockResolvedValue([
        { authorId: "user-active" },
      ]);

      const result = await adminCaller().previewSupervisorTransformation({
        userId: MOCK_IDS.USER_2,
      });

      expect(result?.managerTransfers).toEqual([
        {
          teamName: "FS Arras",
          newManagerName: "Marie Curie",
          hasOtherManagers: false,
        },
      ]);
    });

    it("flags managed team when other managers exist (no transfer needed)", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [],
        managedTeams: [{ id: MOCK_IDS.TEAM_1, name: "FS Arras" }],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(2); // other managers exist
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await adminCaller().previewSupervisorTransformation({
        userId: MOCK_IDS.USER_2,
      });

      expect(result?.managerTransfers).toEqual([
        {
          teamName: "FS Arras",
          newManagerName: null,
          hasOtherManagers: true,
        },
      ]);
    });

    it("flags managed team with no replacement when no active members", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [],
        managedTeams: [{ id: MOCK_IDS.TEAM_1, name: "FS Arras" }],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0); // no other managers
      (prisma.user.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // newAuthorIds lookup
        .mockResolvedValueOnce([]); // no active members

      const result = await adminCaller().previewSupervisorTransformation({
        userId: MOCK_IDS.USER_2,
      });

      expect(result?.managerTransfers).toEqual([
        {
          teamName: "FS Arras",
          newManagerName: null,
          hasOtherManagers: false,
        },
      ]);
    });
  });

  describe("transformToSupervisor", () => {
    const adminCaller = () =>
      createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

    const validInput = {
      userId: MOCK_IDS.USER_2,
      areaIds: [MOCK_IDS.AREA_1],
      organizationIds: [MOCK_IDS.ORG_1],
    };

    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({ userId: null, user: null });
      await expect(
        caller.transformToSupervisor(validInput),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws FORBIDDEN when caller is not admin", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.transformToSupervisor(validInput),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("rejects input with no areas and no organizations (Zod refine)", async () => {
      await expect(
        adminCaller().transformToSupervisor({
          userId: MOCK_IDS.USER_2,
          areaIds: [],
          organizationIds: [],
        }),
      ).rejects.toThrow(/au moins un territoire ou une organisation/i);
    });

    it("throws when targeting self", async () => {
      await expect(
        adminCaller().transformToSupervisor({
          ...validInput,
          userId: MOCK_IDS.USER_1,
        }),
      ).rejects.toThrow("Impossible de transformer votre propre compte.");
    });

    it("throws when target user is not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        adminCaller().transformToSupervisor(validInput),
      ).rejects.toThrow("Utilisateur non trouvé.");
    });

    it("throws when target user is admin", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.ADMIN,
        isInactive: null,
        teams: [],
        managedTeams: [],
      });

      await expect(
        adminCaller().transformToSupervisor(validInput),
      ).rejects.toThrow("Impossible de transformer un administrateur.");
    });

    it("throws when target user is already a supervisor", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.SUPERVISOR,
        isInactive: null,
        teams: [],
        managedTeams: [],
      });

      await expect(
        adminCaller().transformToSupervisor(validInput),
      ).rejects.toThrow("Cet utilisateur est déjà superviseur.");
    });

    it("throws when target user is inactive", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: MOCK_DATES.JAN_1_2024,
        teams: [],
        managedTeams: [],
      });

      await expect(
        adminCaller().transformToSupervisor(validInput),
      ).rejects.toThrow("Ce compte est désactivé.");
    });

    it("transforms user with no teams or reports (minimal transaction)", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [],
        managedTeams: [],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author
        .mockResolvedValueOnce([]); // recipient
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      const result = await adminCaller().transformToSupervisor(validInput);

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // 3 base ops: user.update (role+teams+managedTeams), supervisor.create, session.deleteMany
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(3);
    });

    it("does NOT save a snapshot or set isInactive (key difference vs deactivation)", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [{ id: MOCK_IDS.TEAM_1 }],
        managedTeams: [],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await adminCaller().transformToSupervisor(validInput);

      expect(prisma.deactivatedUserTeamSnapshot.upsert).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_IDS.USER_2 },
          data: expect.objectContaining({
            role: USER_ROLES.SUPERVISOR,
            teams: { set: [] },
            managedTeams: { set: [] },
          }),
        }),
      );
      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.isInactive).toBeUndefined();
    });

    it("creates supervisor record with provided areas and organizations", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [],
        managedTeams: [],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await adminCaller().transformToSupervisor({
        userId: MOCK_IDS.USER_2,
        areaIds: [MOCK_IDS.AREA_1, MOCK_IDS.AREA_2],
        organizationIds: [MOCK_IDS.ORG_1],
      });

      expect(prisma.supervisor.create).toHaveBeenCalledWith({
        data: {
          userId: MOCK_IDS.USER_2,
          areas: {
            connect: [{ id: MOCK_IDS.AREA_1 }, { id: MOCK_IDS.AREA_2 }],
          },
          organizations: { connect: [{ id: MOCK_IDS.ORG_1 }] },
        },
      });
    });

    it("invalidates user sessions", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [],
        managedTeams: [],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await adminCaller().transformToSupervisor(validInput);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_2 },
      });
    });

    it("reassigns manager when target was sole manager and active members remain", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [],
        managedTeams: [{ id: MOCK_IDS.TEAM_1 }],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0); // no other managers
      (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "active-1" },
      ]);
      (prisma.answer.findMany as jest.Mock).mockResolvedValue([
        { authorId: "active-1" },
      ]);
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await adminCaller().transformToSupervisor(validInput);

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        data: { managers: { connect: { id: "active-1" } } },
      });
      // Transaction grew by 1 manager reassignment op (3 base + 1 = 4)
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(4);
    });

    it("does not reassign manager when other managers exist", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "Jean",
        lastName: "Dupont",
        role: USER_ROLES.USER,
        isInactive: null,
        teams: [],
        managedTeams: [{ id: MOCK_IDS.TEAM_1 }],
      });
      (prisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(2); // other managers exist
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await adminCaller().transformToSupervisor(validInput);

      expect(prisma.team.update).not.toHaveBeenCalled();
    });
  });

  describe("reactivateUser", () => {
    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(
        caller.reactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws error when target user is not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.reactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toThrow("Utilisateur non trouvé.");
    });

    it("throws error when user is already active", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockTargetUser,
        isInactive: null,
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(
        caller.reactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toThrow("Ce compte est déjà actif.");
    });

    it("throws FORBIDDEN when caller is not admin and not manager of user's former team", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      }); // target user (inactive)

      (
        prisma.deactivatedUserTeamSnapshot.findUnique as jest.Mock
      ).mockResolvedValue(mockSnapshot);

      (prisma.team.findFirst as jest.Mock).mockResolvedValueOnce(null); // not a manager of any former team

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.reactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message:
          "Vous devez être administrateur ou manager de l'équipe pour effectuer cette action.",
      });
    });

    it("reactivates user and restores teams from snapshot when admin", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      }); // target user (inactive)

      (
        prisma.deactivatedUserTeamSnapshot.findUnique as jest.Mock
      ).mockResolvedValue(mockSnapshot);

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.reactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });
      expect(
        prisma.deactivatedUserTeamSnapshot.findUnique,
      ).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_2 },
        select: {
          id: true,
          teams: {
            where: { deletedAt: null },
            select: { id: true },
          },
          managedTeams: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Verify transaction was called with an array of 2 operations (update + delete snapshot)
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(2);
    });

    it("sends reactivation email to the user after successful reactivation", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      }); // target user (inactive)

      (
        prisma.deactivatedUserTeamSnapshot.findUnique as jest.Mock
      ).mockResolvedValue(mockSnapshot);

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.reactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
      expect(sendTemplatedEmail).toHaveBeenCalledWith("ACCOUNT_REACTIVATED", {
        to: [{ email: "jean.dupont@example.com" }],
        params: {
          userFirstName: "Jean",
          linkUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
        },
      });
    });

    it("sets notificationsViewedBefore to current date on reactivation", async () => {
      const beforeTest = new Date();

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      });

      (
        prisma.deactivatedUserTeamSnapshot.findUnique as jest.Mock
      ).mockResolvedValue(mockSnapshot);

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.reactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_IDS.USER_2 },
          data: expect.objectContaining({
            isInactive: null,
            notificationsViewedBefore: expect.any(Date),
          }),
        }),
      );

      const updateCall = (prisma.user.update as jest.Mock).mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { data?: { isInactive?: null } })?.data?.isInactive ===
          null,
      );
      const notificationsViewedBefore = (
        updateCall![0] as {
          data: { notificationsViewedBefore: Date };
        }
      ).data.notificationsViewedBefore;
      expect(notificationsViewedBefore.getTime()).toBeGreaterThanOrEqual(
        beforeTest.getTime(),
      );
    });

    it("reactivates user without snapshot when no snapshot exists", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      }); // target user (inactive)

      (
        prisma.deactivatedUserTeamSnapshot.findUnique as jest.Mock
      ).mockResolvedValue(null);

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.reactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Transaction should only contain user.update (no snapshot delete)
      const transactionCall = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionCall).toHaveLength(1);
    });

    it("throws FORBIDDEN when caller is manager of a different team", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      }); // target user (inactive)

      (
        prisma.deactivatedUserTeamSnapshot.findUnique as jest.Mock
      ).mockResolvedValue(mockSnapshot);

      (prisma.team.findFirst as jest.Mock).mockResolvedValueOnce(null); // manager of different team

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.reactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message:
          "Vous devez être administrateur ou manager de l'équipe pour effectuer cette action.",
      });
    });

    it("reactivates user when caller is supervisor with former team in scope", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      }); // target user (inactive)

      (
        prisma.deactivatedUserTeamSnapshot.findUnique as jest.Mock
      ).mockResolvedValue(mockSnapshot);

      // Supervisor record with matching scope
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "supervisor-1",
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      });

      // Former team is in scope
      (prisma.team.findFirst as jest.Mock).mockResolvedValueOnce({
        id: MOCK_IDS.TEAM_1,
      });

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.reactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });
      expect(prisma.supervisor.findUnique).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_1 },
        include: { areas: true, organizations: true },
      });
    });

    it("throws FORBIDDEN when supervisor and former teams are out of scope", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      }); // target user (inactive)

      (
        prisma.deactivatedUserTeamSnapshot.findUnique as jest.Mock
      ).mockResolvedValue(mockSnapshot);

      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "supervisor-1",
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      });

      // No former team in scope
      (prisma.team.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(
        caller.reactivateUser({ userId: MOCK_IDS.USER_2 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Utilisateur hors de votre périmètre.",
      });
    });

    it("reactivates user when caller is manager of user's former team", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockTargetUser,
        isInactive: MOCK_DATES.JAN_1_2024,
      }); // target user (inactive)

      (
        prisma.deactivatedUserTeamSnapshot.findUnique as jest.Mock
      ).mockResolvedValue(mockSnapshot);

      // Manager of one of the user's former teams
      (prisma.team.findFirst as jest.Mock).mockResolvedValueOnce({
        id: MOCK_IDS.TEAM_1,
      });

      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.reactivateUser({ userId: MOCK_IDS.USER_2 });

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("isManager", () => {
    it("returns false when user is not logged in", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      const result = await caller.isManager();

      expect(result).toBe(false);
      expect(prisma.team.count).not.toHaveBeenCalled();
    });

    it("returns true when user manages at least one team", async () => {
      (prisma.team.count as jest.Mock).mockResolvedValue(2);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.isManager();

      expect(result).toBe(true);
      expect(prisma.team.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          managers: {
            some: { id: MOCK_IDS.USER_1 },
          },
        },
      });
    });

    it("returns false when user does not manage any team", async () => {
      (prisma.team.count as jest.Mock).mockResolvedValue(0);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.isManager();

      expect(result).toBe(false);
    });
  });

  describe("canDisableNotifications", () => {
    it("returns false when user has no teams", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        teams: [],
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.canDisableNotifications();

      expect(result).toBe(false);
    });

    it("returns true when all teams have other notifiable members", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        teams: [
          { id: MOCK_IDS.TEAM_1, users: [{ id: MOCK_IDS.USER_2 }] },
          { id: MOCK_IDS.TEAM_2, users: [{ id: "user-3" }] },
        ],
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.canDisableNotifications();

      expect(result).toBe(true);
    });

    it("returns false when any team has no other notifiable members", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        teams: [
          { id: MOCK_IDS.TEAM_1, users: [{ id: MOCK_IDS.USER_2 }] },
          { id: MOCK_IDS.TEAM_2, users: [] }, // no other notifiable members
        ],
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.canDisableNotifications();

      expect(result).toBe(false);
    });

    it("returns false when user is not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.canDisableNotifications();

      expect(result).toBe(false);
    });

    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.canDisableNotifications()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("updateProfile", () => {
    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(
        caller.updateProfile({
          firstName: "John",
          lastName: "Doe",
        }),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws error when non-manager tries to set notificationFrequency to NONE", async () => {
      (prisma.team.count as jest.Mock).mockResolvedValue(0);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.updateProfile({
          firstName: "John",
          lastName: "Doe",
          notificationFrequency: NotificationFrequency.NONE,
        }),
      ).rejects.toThrow(
        "Seuls les responsables d'équipe ou superviseurs peuvent désactiver les notifications.",
      );

      expect(prisma.team.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          managers: { some: { id: MOCK_IDS.USER_1 } },
        },
      });
    });

    it("allows managers to set notificationFrequency to NONE", async () => {
      (prisma.team.count as jest.Mock).mockResolvedValue(1);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        teams: [
          {
            id: MOCK_IDS.TEAM_1,
            name: "Equipe 1",
            users: [{ id: MOCK_IDS.USER_2 }],
          },
        ],
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_1,
        firstName: "John",
        lastName: "Doe",
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.updateProfile({
        firstName: "John",
        lastName: "Doe",
        notificationFrequency: NotificationFrequency.NONE,
      });

      expect(result).toEqual({ success: true });
      expect(prisma.team.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          managers: { some: { id: MOCK_IDS.USER_1 } },
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.USER_1 },
        data: expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          notificationFrequency: NotificationFrequency.NONE,
        }),
      });
    });

    it("throws error when manager is last notifiable member in a team", async () => {
      (prisma.team.count as jest.Mock).mockResolvedValue(1);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        teams: [
          {
            id: MOCK_IDS.TEAM_1,
            name: "Equipe Solitaire",
            users: [], // no other notifiable members
          },
        ],
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.updateProfile({
          firstName: "John",
          lastName: "Doe",
          notificationFrequency: NotificationFrequency.NONE,
        }),
      ).rejects.toThrow(
        "Vous ne pouvez pas désactiver les notifications car vous êtes le dernier membre actif avec des notifications activées dans l'équipe : Equipe Solitaire.",
      );
    });

    it("allows non-managers to set other notificationFrequency values", async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_1,
        firstName: "John",
        lastName: "Doe",
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.updateProfile({
        firstName: "John",
        lastName: "Doe",
        notificationFrequency: NotificationFrequency.TWICE_DAILY,
      });

      expect(result).toEqual({ success: true });
      expect(prisma.team.count).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.USER_1 },
        data: expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          notificationFrequency: NotificationFrequency.TWICE_DAILY,
        }),
      });
    });
  });

  describe("getUsers", () => {
    it("returns empty result for non-admin non-manager non-supervisor", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: USER_ROLES.USER,
        managedTeams: [],
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getUsers();

      expect(result).toEqual({ items: [], total: 0, totalPages: 0 });
    });

    it("returns users filtered by supervisor areas and organizations", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: USER_ROLES.SUPERVISOR,
        managedTeams: [],
      });

      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );

      const mockUsers = [
        {
          id: MOCK_IDS.USER_2,
          email: "user@example.com",
          firstName: "Jane",
          lastName: "Doe",
          role: USER_ROLES.USER,
          isInactive: null,
          teams: [],
          managedTeams: [],
          deactivatedTeamSnapshot: null,
        },
      ];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.getUsers();

      expect(result.items).toEqual(mockUsers);
      expect(result.total).toBe(1);
      expect(prisma.supervisor.findUnique).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_1 },
        include: { areas: true, organizations: true },
      });

      const teamScope = {
        organizationId: { in: [MOCK_IDS.ORG_1] },
        areas: { some: { id: { in: [MOCK_IDS.AREA_1] } } },
      };
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { teams: { some: teamScope } },
                  {
                    isInactive: { not: null },
                    deactivatedTeamSnapshot: {
                      teams: { some: teamScope },
                    },
                  },
                ],
              },
              { deletedAt: null },
              {},
            ],
          },
        }),
      );
    });

    it("returns empty result when supervisor record not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: USER_ROLES.SUPERVISOR,
        managedTeams: [],
      });
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.getUsers();

      expect(result).toEqual({ items: [], total: 0, totalPages: 0 });
    });

    it("excludes soft-deleted teams from the selected teams and deactivated snapshot", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: USER_ROLES.ADMIN,
        managedTeams: [],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.getUsers();

      const findManyArgs = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyArgs.select.teams).toMatchObject({
        where: { deletedAt: null },
      });
      expect(
        findManyArgs.select.deactivatedTeamSnapshot.select.teams,
      ).toMatchObject({
        where: { deletedAt: null },
      });
    });
  });

  describe("completeRegistration", () => {
    const validInput = {
      token: "valid-token",
      firstName: "Maxime",
      lastName: "Acadine",
      password: "Password123!",
      passwordConfirmation: "Password123!",
      phone: null,
      profession: null,
      cguAccepted: true,
    };

    const pendingUser = {
      id: "pending-1",
      email: "maxime@example.com",
      firstName: null,
      lastName: null,
      tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      teams: [{ id: "team-1" }],
      managedTeams: [],
    };

    function makeTx(overrides: Record<string, unknown> = {}) {
      return {
        user: { update: jest.fn() },
        pendingSupervisor: {
          findUnique: jest.fn().mockResolvedValue(null),
          delete: jest.fn(),
        },
        supervisor: { create: jest.fn() },
        pendingUser: { delete: jest.fn() },
        ...overrides,
      };
    }

    function caller() {
      return createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });
    }

    beforeEach(() => {
      (prisma.pendingUser.findUnique as jest.Mock).mockResolvedValue(
        pendingUser,
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.delete as jest.Mock).mockResolvedValue(undefined);
      (prisma.pendingUser.delete as jest.Mock).mockResolvedValue(undefined);
      (auth.api.signUpEmail as unknown as jest.Mock).mockResolvedValue({
        user: { id: "new-user-1" },
      });
      (prisma.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(makeTx()),
      );
    });

    it("nettoie l'invitation orpheline et n'en crée pas de doublon si un compte existe déjà", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-user",
      });

      await expect(caller().completeRegistration(validInput)).rejects.toThrow(
        "Un compte existe déjà",
      );
      expect(prisma.pendingUser.delete).toHaveBeenCalledWith({
        where: { id: "pending-1" },
      });
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it("finalise l'inscription dans une transaction et supprime l'invitation", async () => {
      const txPendingDelete = jest.fn();
      (prisma.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(makeTx({ pendingUser: { delete: txPendingDelete } })),
      );

      const result = await caller().completeRegistration(validInput);

      expect(auth.api.signUpEmail).toHaveBeenCalled();
      expect(txPendingDelete).toHaveBeenCalledWith({
        where: { id: "pending-1" },
      });
      expect(result).toMatchObject({ success: true, userId: "new-user-1" });
    });

    it("supprime le compte créé (compensation) si une étape post-création échoue", async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("connect team failed"),
      );

      await expect(caller().completeRegistration(validInput)).rejects.toThrow(
        "Une erreur est survenue",
      );
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: "new-user-1" },
      });
    });
  });

  describe("resendInvitation", () => {
    it("supprime l'orphelin et refuse si un compte existe déjà pour l'email", async () => {
      (prisma.pendingUser.findUnique as jest.Mock).mockResolvedValue({
        id: "pending-1",
        email: "maxime@example.com",
        firstName: null,
        lastName: null,
        teams: [],
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-user",
      });
      (prisma.pendingUser.delete as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(
        caller.resendInvitation({ pendingUserId: "pending-1" }),
      ).rejects.toThrow("Un compte existe déjà");
      expect(prisma.pendingUser.delete).toHaveBeenCalledWith({
        where: { id: "pending-1" },
      });
    });
  });
});
