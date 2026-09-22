import { createCallerFactory } from "../init";
import { teamRouter } from "./team";
import prisma from "@/lib/prisma";
import { OrganizationRole, TeamType } from "@/generated/prisma/enums";
import { createMockUser, MOCK_IDS, MOCK_DATES, USER_ROLES } from "@/test/mocks";
import {
  searchTeamsWithUnaccent,
  buildTeamSearchConditions,
} from "@/utils/search";
import {
  processTeamRemovalReports,
  processTeamDeletionReports,
} from "@/app/services/user/user-team-removal";
import {
  checkApplicantTeamAccess,
  checkOrganizationAccess,
  checkReportAccess,
  checkTeamAccess,
  checkTeamModifyAccess,
} from "../middleware/authorization";

jest.mock("../middleware/authorization", () => ({
  checkApplicantTeamAccess: jest.fn(),
  checkManagerCreatesInOwnOrganization: jest.fn(),
  checkOrganizationAccess: jest.fn(),
  checkReportAccess: jest.fn(),
  checkTeamAccess: jest.fn(),
  checkTeamModifyAccess: jest.fn(),
}));

jest.mock("@/utils/search", () => ({
  searchTeamsWithUnaccent: jest.fn(),
  buildTeamSearchConditions: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    team: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    report: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    pendingUser: {
      upsert: jest.fn(),
    },
    supervisor: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  },
}));

jest.mock("@/app/services/user/user-team-removal", () => ({
  processTeamRemovalReports: jest
    .fn()
    .mockResolvedValue({ operations: [], scenarios: [] }),
  processTeamDeletionReports: jest.fn().mockResolvedValue({ operations: [] }),
}));

jest.mock("@/utils/role", () => ({
  userIsManager: jest.fn(() => Promise.resolve(false)),
}));

jest.mock("@/utils/verification-token", () => ({
  createVerificationToken: jest
    .fn()
    .mockResolvedValue("mock-verification-token"),
}));

const createCaller = createCallerFactory(teamRouter);

const mockTeam1 = {
  id: MOCK_IDS.TEAM_1,
  name: "Team Alpha",
  email: "alpha@example.com",
  description: "First team",
  registrationNumber: "REG-001",
  adminComment: null,
  role: OrganizationRole.HELPER,
  organizationId: MOCK_IDS.ORG_1,
  createdAt: MOCK_DATES.JAN_1_2024,
  updatedAt: MOCK_DATES.JAN_1_2024,
};

const mockTeam2 = {
  id: MOCK_IDS.TEAM_2,
  name: "Team Beta",
  email: "beta@example.com",
  description: "Second team",
  registrationNumber: "REG-002",
  adminComment: null,
  role: OrganizationRole.OPERATOR,
  organizationId: MOCK_IDS.ORG_1,
  createdAt: MOCK_DATES.JAN_2_2024,
  updatedAt: MOCK_DATES.JAN_2_2024,
};

const mockOrganization = {
  id: MOCK_IDS.ORG_1,
  name: "France Services",
  role: OrganizationRole.HELPER,
  type: TeamType.FRANCE_SERVICE,
};

describe("teamRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getTeams", () => {
    it("returns all teams for admin users", async () => {
      const mockTeams = [mockTeam1, mockTeam2];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.getTeams();

      expect(result).toEqual(mockTeams);
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });

    it("throws FORBIDDEN for non-admin users", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(caller.getTeams()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.team.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getTeamById", () => {
    it("returns team with minimal selections on relations", async () => {
      const mockTeamWithIncludes = {
        ...mockTeam1,
        managers: [],
        users: [],
        pendingManagers: [],
        pendingUsers: [],
        areas: [],
        organization: mockOrganization,
      };
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithIncludes,
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getTeamById(MOCK_IDS.TEAM_1);

      expect(result).toEqual(mockTeamWithIncludes);
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { deletedAt: null, id: MOCK_IDS.TEAM_1 },
        include: {
          managers: { select: { id: true } },
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              profession: true,
              isInactive: true,
              // seules les dates servent (dernière activité) : jamais les
              // lignes Report complètes des membres
              authoredReports: { select: { createdAt: true } },
              coAuthoredReports: { select: { createdAt: true } },
            },
          },
          pendingManagers: { select: { id: true } },
          pendingUsers: { select: { id: true, email: true } },
          areas: true,
          organization: true,
        },
      });
    });

    it("throws FORBIDDEN when checkTeamAccess denies access", async () => {
      (checkTeamAccess as jest.Mock).mockRejectedValueOnce(
        new (jest.requireActual("@trpc/server").TRPCError)({
          code: "FORBIDDEN",
          message: "Vous n'avez pas accès à cette équipe.",
        }),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(caller.getTeamById(MOCK_IDS.TEAM_1)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.team.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("getExistingTeamsByOrganizationAndAreas", () => {
    it("throws FORBIDDEN when checkOrganizationAccess denies access", async () => {
      (checkOrganizationAccess as jest.Mock).mockRejectedValueOnce(
        new (jest.requireActual("@trpc/server").TRPCError)({
          code: "FORBIDDEN",
          message: "Vous n'avez pas accès à cette organisation.",
        }),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.getExistingTeamsByOrganizationAndAreas({
          organizationId: MOCK_IDS.ORG_1,
          areaIds: [MOCK_IDS.AREA_1],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prisma.team.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getNotInvitedTeamsByReportId", () => {
    it("throws FORBIDDEN when access is denied", async () => {
      (checkReportAccess as jest.Mock).mockRejectedValueOnce(
        new (jest.requireActual("@trpc/server").TRPCError)({
          code: "FORBIDDEN",
          message: "Vous n'avez pas accès à ce signalement.",
        }),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.getNotInvitedTeamsByReportId({
          reportId: MOCK_IDS.REPORT_1,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.report.findUnique).not.toHaveBeenCalled();
    });

    it("returns empty array when report not found", async () => {
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getNotInvitedTeamsByReportId({
        reportId: MOCK_IDS.REPORT_1,
      });

      expect(result).toEqual([]);
    });

    it("returns operator teams not already invited", async () => {
      const mockReport = {
        id: MOCK_IDS.REPORT_1,
        areaId: MOCK_IDS.AREA_1,
        area: { id: MOCK_IDS.AREA_1 },
        requestedTeams: [{ id: MOCK_IDS.TEAM_1 }],
        applicantTeam: { type: TeamType.FRANCE_SERVICE },
      };
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([mockTeam2]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getNotInvitedTeamsByReportId({
        reportId: MOCK_IDS.REPORT_1,
      });

      expect(result).toEqual([mockTeam2]);
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: {
          areas: { some: { id: MOCK_IDS.AREA_1 } },
          role: OrganizationRole.OPERATOR,
          id: { not: { in: [MOCK_IDS.TEAM_1] } },
          users: { some: {} },
          acceptTypes: { has: TeamType.FRANCE_SERVICE },
          deletedAt: null,
        },
        include: {
          organization: {
            include: {
              specificFields: true,
              tags: true,
            },
          },
        },
      });
    });
  });

  describe("getActiveOperatorTeamsByAreaIds", () => {
    it("throws FORBIDDEN when checkApplicantTeamAccess denies access", async () => {
      (checkApplicantTeamAccess as jest.Mock).mockRejectedValueOnce(
        new (jest.requireActual("@trpc/server").TRPCError)({
          code: "FORBIDDEN",
          message: "Vous n'avez pas accès à cette équipe.",
        }),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.getActiveOperatorTeamsByAreaIds({
          areaIds: [MOCK_IDS.AREA_1],
          applicantTeamId: MOCK_IDS.TEAM_1,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prisma.team.findUnique).not.toHaveBeenCalled();
    });

    it("returns operator teams with users in given areas", async () => {
      const mockTeams = [mockTeam2];
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        type: TeamType.FRANCE_SERVICE,
      });
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getActiveOperatorTeamsByAreaIds({
        areaIds: [MOCK_IDS.AREA_1, MOCK_IDS.AREA_2],
        applicantTeamId: MOCK_IDS.TEAM_1,
      });

      expect(result).toEqual(mockTeams);
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        select: { type: true },
      });
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: {
          areas: { some: { id: { in: [MOCK_IDS.AREA_1, MOCK_IDS.AREA_2] } } },
          role: OrganizationRole.OPERATOR,
          users: { some: {} },
          acceptTypes: { has: TeamType.FRANCE_SERVICE },
          deletedAt: null,
        },
        include: {
          organization: {
            include: {
              specificFields: true,
              tags: true,
            },
          },
        },
      });
    });
  });

  describe("getMyTeams", () => {
    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.getMyTeams()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(prisma.team.findMany).not.toHaveBeenCalled();
    });

    it("returns paginated teams for admin users", async () => {
      const mockTeams = [mockTeam1, mockTeam2];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(2) }]) // count query
        .mockResolvedValueOnce([{ id: mockTeam1.id }, { id: mockTeam2.id }]); // ids query

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.getMyTeams({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: mockTeams,
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });
    });

    it("filters teams by search query for admin users", async () => {
      const mockTeams = [mockTeam1];
      (searchTeamsWithUnaccent as jest.Mock).mockResolvedValue({
        ids: [mockTeam1.id],
        total: 1,
      });
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.getMyTeams({ search: "Alpha" });

      expect(result.items).toEqual(mockTeams);
      expect(result.total).toBe(1);
      expect(searchTeamsWithUnaccent).toHaveBeenCalledWith("Alpha", 1, 10);
      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [mockTeam1.id] }, deletedAt: null },
        }),
      );
    });

    it("sorts search results across the entire dataset via a single SQL query for admin", async () => {
      const page2Teams = [
        { ...mockTeam1, id: "team-page2-1", name: "France Services Z" },
        { ...mockTeam2, id: "team-page2-2", name: "France Services Y" },
      ];
      const teamIds = page2Teams.map((t) => t.id);

      // buildTeamSearchConditions returns the WHERE clause for search
      (buildTeamSearchConditions as jest.Mock).mockReturnValue({
        whereSQL: `(unaccent(t."name") ILIKE unaccent($1))`,
        params: ["%France Services%"],
      });

      // getSortedTeamIds: count query then sort query (with pagination)
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(20) }])
        .mockResolvedValueOnce(teamIds.map((id) => ({ id })));

      (prisma.team.findMany as jest.Mock).mockResolvedValue(page2Teams);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.getMyTeams({
        search: "France Services",
        page: 2,
        pageSize: 10,
        sortBy: "name",
        sortOrder: "asc",
      });

      // searchTeamsWithUnaccent should NOT be called when sortBy is provided
      expect(searchTeamsWithUnaccent).not.toHaveBeenCalled();
      expect(buildTeamSearchConditions).toHaveBeenCalledWith("France Services");
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(20);
      expect(result.totalPages).toBe(2);

      // Verify the sort query DOES contain LIMIT/OFFSET (pagination on full dataset)
      const sortQuery = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[1][0];
      expect(sortQuery).toContain("LIMIT");
      expect(sortQuery).toContain("OFFSET");
    });

    it("returns paginated teams for supervisor filtered by areas and organizations", async () => {
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );

      const mockTeams = [mockTeam1];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ id: mockTeam1.id }]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.getMyTeams({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: mockTeams,
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });
      expect(prisma.supervisor.findUnique).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_1 },
        include: { areas: true, organizations: true },
      });
    });

    it("filters teams by search query for supervisor", async () => {
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );
      (searchTeamsWithUnaccent as jest.Mock).mockResolvedValue({
        ids: [mockTeam1.id],
        total: 1,
      });
      (prisma.team.findMany as jest.Mock).mockResolvedValue([mockTeam1]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.getMyTeams({ search: "Alpha" });

      expect(result.items).toEqual([mockTeam1]);
      expect(result.total).toBe(1);
      expect(searchTeamsWithUnaccent).toHaveBeenCalledWith("Alpha", 1, 10, {
        areaIds: [MOCK_IDS.AREA_1],
        organizationIds: [MOCK_IDS.ORG_1],
      });
    });

    it("sorts search results across the entire dataset via a single SQL query for supervisor", async () => {
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );

      const page2Teams = [
        { ...mockTeam1, id: "team-page2-1", name: "France Services Z" },
      ];
      const teamIds = page2Teams.map((t) => t.id);

      // buildTeamSearchConditions returns the WHERE clause for search with scope
      (buildTeamSearchConditions as jest.Mock).mockReturnValue({
        whereSQL: `(unaccent(t."name") ILIKE unaccent($1)) AND t."organizationId" IN ($2)`,
        params: ["%France Services%", MOCK_IDS.ORG_1],
      });

      // getSortedTeamIds: count query then sort query (with pagination)
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(15) }])
        .mockResolvedValueOnce(teamIds.map((id) => ({ id })));

      (prisma.team.findMany as jest.Mock).mockResolvedValue(page2Teams);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.getMyTeams({
        search: "France Services",
        page: 2,
        pageSize: 10,
        sortBy: "name",
        sortOrder: "asc",
      });

      // searchTeamsWithUnaccent should NOT be called when sortBy is provided
      expect(searchTeamsWithUnaccent).not.toHaveBeenCalled();
      expect(buildTeamSearchConditions).toHaveBeenCalledWith(
        "France Services",
        {
          areaIds: [MOCK_IDS.AREA_1],
          organizationIds: [MOCK_IDS.ORG_1],
        },
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(15);
      expect(result.totalPages).toBe(2);

      // Verify the sort query DOES contain LIMIT/OFFSET (pagination on full dataset)
      const sortQuery = (prisma.$queryRawUnsafe as jest.Mock).mock.calls[1][0];
      expect(sortQuery).toContain("LIMIT");
      expect(sortQuery).toContain("OFFSET");
    });

    it("returns empty result when supervisor record not found", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.getMyTeams();

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });
    });

    it("returns user teams without pagination for non-admin users", async () => {
      const mockTeams = [mockTeam1];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);
      (prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ id: mockTeam1.id }]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getMyTeams();

      expect(result).toEqual({
        items: mockTeams,
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [mockTeam1.id] }, deletedAt: null },
        }),
      );
    });
  });

  describe("getTeamsByUserId", () => {
    it("returns teams for specific user", async () => {
      const mockTeams = [mockTeam1];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getTeamsByUserId(MOCK_IDS.USER_1);

      expect(result).toEqual(mockTeams);
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: { users: { some: { id: MOCK_IDS.USER_1 } }, deletedAt: null },
      });
    });
  });

  describe("getColleaguesByTeamId", () => {
    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(
        caller.getColleaguesByTeamId(MOCK_IDS.TEAM_1),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("returns team members excluding current user", async () => {
      const mockUsers = [createMockUser({ id: MOCK_IDS.USER_2 })];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getColleaguesByTeamId(MOCK_IDS.TEAM_1);

      expect(result).toEqual(mockUsers);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          teams: { some: { id: MOCK_IDS.TEAM_1 } },
          id: { not: MOCK_IDS.USER_1 },
          isInactive: null,
          deletedAt: null,
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
    });
  });

  describe("updateTeam", () => {
    it("updates team with provided data", async () => {
      const updatedTeam = { ...mockTeam1, name: "Updated Team" };
      (prisma.team.update as jest.Mock).mockResolvedValue(updatedTeam);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.updateTeam({
        id: MOCK_IDS.TEAM_1,
        name: "Updated Team",
        email: "updated@example.com",
        description: "Updated description",
      });

      expect(result).toEqual(updatedTeam);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        data: {
          name: "Updated Team",
          email: "updated@example.com",
          description: "Updated description",
        },
      });
    });

    it("throws FORBIDDEN when checkTeamModifyAccess denies access", async () => {
      (checkTeamModifyAccess as jest.Mock).mockRejectedValueOnce(
        new (jest.requireActual("@trpc/server").TRPCError)({
          code: "FORBIDDEN",
          message: "Vous devez être administrateur ou manager de cette équipe.",
        }),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.updateTeam({
          id: MOCK_IDS.TEAM_1,
          name: "Updated Team",
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.team.update).not.toHaveBeenCalled();
    });
  });

  describe("addUserToTeam", () => {
    it("connects existing users to team", async () => {
      const mockExistingUsers = [
        { id: MOCK_IDS.USER_2, email: "user2@example.com" },
      ];

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            user: {
              findMany: jest.fn().mockResolvedValue(mockExistingUsers),
              update: jest.fn().mockResolvedValue(mockExistingUsers[0]),
            },
            pendingUser: {
              upsert: jest.fn(),
            },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.addUserToTeam({
        teamId: MOCK_IDS.TEAM_1,
        users: [{ email: "user2@example.com", isManager: false }],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveProperty("updatedUsers");
      expect(result).toHaveProperty("createdPendingUsers");
    });

    it("creates pending users for non-existing emails", async () => {
      const mockPendingUser = {
        email: "newuser@example.com",
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            user: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            pendingUser: {
              upsert: jest.fn().mockResolvedValue(mockPendingUser),
            },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.addUserToTeam({
        teamId: MOCK_IDS.TEAM_1,
        users: [{ email: "newuser@example.com", isManager: false }],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveProperty("createdPendingUsers");
    });
  });

  describe("removeUserFromTeam", () => {
    it("processes reports and disconnects user from team", async () => {
      // Mock user lookup for name
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "John",
        lastName: "Doe",
      });

      // Mock transaction
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.removeUserFromTeam({
        teamId: MOCK_IDS.TEAM_1,
        userId: MOCK_IDS.USER_2,
      });

      expect(result).toEqual({ success: true });
      expect(checkTeamModifyAccess).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_IDS.TEAM_1,
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.USER_2 },
        select: { firstName: true, lastName: true },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("throws FORBIDDEN when checkTeamModifyAccess denies access", async () => {
      (checkTeamModifyAccess as jest.Mock).mockRejectedValueOnce(
        new (jest.requireActual("@trpc/server").TRPCError)({
          code: "FORBIDDEN",
          message: "Vous devez être administrateur ou manager de cette équipe.",
        }),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.removeUserFromTeam({
          teamId: MOCK_IDS.TEAM_1,
          userId: MOCK_IDS.USER_2,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("previewRemoveFromTeam", () => {
    it("returns null when user or team not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.previewRemoveFromTeam({
        teamId: MOCK_IDS.TEAM_1,
        userId: MOCK_IDS.USER_2,
      });

      expect(result).toBeNull();
    });

    it("returns enriched scenarios", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        firstName: "John",
        lastName: "Doe",
      });
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.TEAM_1,
        name: "Test Team",
      });
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.previewRemoveFromTeam({
        teamId: MOCK_IDS.TEAM_1,
        userId: MOCK_IDS.USER_2,
      });

      expect(result).toEqual({
        scenarios: [],
        teamName: "Test Team",
      });
    });
  });

  describe("getManagerInheritedTeamType", () => {
    it("returns null when manager has no teams", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getManagerInheritedTeamType();
      expect(result).toBeNull();
    });

    it("returns inherited type when all teams have same type", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { type: TeamType.FRANCE_SERVICE },
        { type: TeamType.FRANCE_SERVICE },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getManagerInheritedTeamType();
      expect(result).toEqual({
        type: TeamType.FRANCE_SERVICE,
        hasDifferentTypes: false,
      });
    });

    it("returns hasDifferentTypes when teams have different types", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { type: TeamType.FRANCE_SERVICE },
        { type: TeamType.TZNR },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getManagerInheritedTeamType();
      expect(result).toEqual({
        type: null,
        hasDifferentTypes: true,
      });
    });

    it("returns null when all teams are OPERATOR type", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { type: TeamType.OPERATOR },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getManagerInheritedTeamType();
      expect(result).toBeNull();
    });

    it("returns hasDifferentTypes when mixing OPERATOR and helper types", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { type: TeamType.OPERATOR },
        { type: TeamType.FRANCE_SERVICE },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getManagerInheritedTeamType();
      expect(result).toEqual({
        type: null,
        hasDifferentTypes: true,
      });
    });
  });

  describe("createTeam", () => {
    it("throws error when non-admin non-manager tries to create team", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.createTeam({
          name: "New Team",
          organizationId: MOCK_IDS.ORG_1,
          areaIds: [MOCK_IDS.AREA_1],
        }),
      ).rejects.toThrow(
        "Seuls les administrateurs, superviseurs et responsables peuvent créer des équipes",
      );
    });

    it("creates team when user is admin without adding admin to team", async () => {
      (prisma.organization.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        type: TeamType.OTHERS_HELPERS,
        role: OrganizationRole.HELPER,
      });
      (prisma.team.create as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.createTeam({
        name: "New Team",
        organizationId: MOCK_IDS.ORG_1,
        areaIds: [MOCK_IDS.AREA_1],
        email: "new@example.com",
        description: "New description",
        registrationNumber: "REG-NEW",
      });

      expect(result).toEqual(mockTeam1);
      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          name: "New Team",
          email: "new@example.com",
          description: "New description",
          registrationNumber: "REG-NEW",
          role: OrganizationRole.HELPER,
          type: TeamType.OTHERS_HELPERS,
          organization: { connect: { id: MOCK_IDS.ORG_1 } },
          areas: { connect: [{ id: MOCK_IDS.AREA_1 }] },
        },
      });
    });

    it("creates team and adds manager to team when user is manager", async () => {
      const { userIsManager } = jest.requireMock("@/utils/role");
      (userIsManager as jest.Mock).mockReturnValueOnce(Promise.resolve(true));
      (prisma.organization.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        type: TeamType.OTHERS_HELPERS,
        role: OrganizationRole.HELPER,
      });
      (prisma.team.create as jest.Mock).mockResolvedValue(mockTeam1);
      // registration number check (return null = no duplicate)
      (prisma.team.findFirst as jest.Mock).mockResolvedValueOnce(null);
      // inherit team type from managed teams
      (prisma.team.findMany as jest.Mock).mockResolvedValueOnce([
        { type: TeamType.OTHERS_HELPERS },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.createTeam({
        name: "New Team",
        organizationId: MOCK_IDS.ORG_1,
        areaIds: [MOCK_IDS.AREA_1],
        email: "new@example.com",
        description: "New description",
        registrationNumber: "REG-NEW",
      });

      expect(result).toEqual(mockTeam1);
      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          name: "New Team",
          email: "new@example.com",
          description: "New description",
          registrationNumber: "REG-NEW",
          role: OrganizationRole.HELPER,
          type: TeamType.OTHERS_HELPERS,
          organization: { connect: { id: MOCK_IDS.ORG_1 } },
          areas: { connect: [{ id: MOCK_IDS.AREA_1 }] },
          managers: { connect: { id: MOCK_IDS.USER_1 } },
          users: { connect: { id: MOCK_IDS.USER_1 } },
        },
      });
    });

    it("inherits organization type by default", async () => {
      (prisma.organization.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        type: TeamType.OPERATOR,
        role: OrganizationRole.OPERATOR,
      });
      (prisma.team.create as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.createTeam({
        name: "Operator Team",
        organizationId: MOCK_IDS.ORG_1,
        areaIds: [MOCK_IDS.AREA_1],
      });

      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TeamType.OPERATOR,
          }),
        }),
      );
    });

    it("derives the team role from the organization, never from the input", async () => {
      (prisma.organization.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        type: TeamType.OPERATOR,
        role: OrganizationRole.OPERATOR,
      });
      (prisma.team.create as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.createTeam({
        name: "Operator Team",
        organizationId: MOCK_IDS.ORG_1,
        areaIds: [MOCK_IDS.AREA_1],
      });

      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: OrganizationRole.OPERATOR,
          }),
        }),
      );
    });

    it("checks the manager's organization scope and propagates the refusal", async () => {
      const { userIsManager } = jest.requireMock("@/utils/role");
      (userIsManager as jest.Mock).mockReturnValueOnce(Promise.resolve(true));
      const { checkManagerCreatesInOwnOrganization } = jest.requireMock(
        "../middleware/authorization",
      );
      (checkManagerCreatesInOwnOrganization as jest.Mock).mockRejectedValueOnce(
        new Error(
          "Vous ne pouvez créer une équipe que dans une organisation où vous gérez déjà une équipe.",
        ),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.createTeam({
          name: "New Team",
          organizationId: MOCK_IDS.ORG_1,
          areaIds: [MOCK_IDS.AREA_1],
        }),
      ).rejects.toThrow(
        "Vous ne pouvez créer une équipe que dans une organisation où vous gérez déjà une équipe.",
      );

      expect(checkManagerCreatesInOwnOrganization).toHaveBeenCalledWith(
        expect.objectContaining({ userId: MOCK_IDS.USER_1 }),
        MOCK_IDS.ORG_1,
      );
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it("allows manager with different team types to choose type", async () => {
      const { userIsManager } = jest.requireMock("@/utils/role");
      (userIsManager as jest.Mock).mockReturnValueOnce(Promise.resolve(true));
      (prisma.organization.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        type: TeamType.FRANCE_SERVICE,
        role: OrganizationRole.HELPER,
      });
      (prisma.team.create as jest.Mock).mockResolvedValue(mockTeam1);
      (prisma.team.findMany as jest.Mock).mockResolvedValueOnce([
        { type: TeamType.FRANCE_SERVICE },
        { type: TeamType.TZNR },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await caller.createTeam({
        name: "New Team",
        organizationId: MOCK_IDS.ORG_1,
        areaIds: [MOCK_IDS.AREA_1],
        type: TeamType.TZNR,
      });

      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TeamType.TZNR,
          }),
        }),
      );
    });

    it("throws error when registration number already exists", async () => {
      (prisma.organization.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        type: TeamType.OTHERS_HELPERS,
      });
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(
        caller.createTeam({
          name: "New Team",
          organizationId: MOCK_IDS.ORG_1,
          areaIds: [MOCK_IDS.AREA_1],
          registrationNumber: "REG-001",
        }),
      ).rejects.toThrow(
        "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule.",
      );
    });
  });

  describe("updateTeamAdmin", () => {
    it("throws FORBIDDEN when non-admin tries to update", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.updateTeamAdmin({
          id: MOCK_IDS.TEAM_1,
          areaIds: [MOCK_IDS.AREA_1],
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("updates team areas and organization for admin", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(
        mockOrganization,
      );
      (prisma.team.update as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.updateTeamAdmin({
        id: MOCK_IDS.TEAM_1,
        areaIds: [MOCK_IDS.AREA_1, MOCK_IDS.AREA_2],
        organizationId: MOCK_IDS.ORG_1,
        adminComment: "Admin comment",
      });

      expect(result).toEqual(mockTeam1);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        data: {
          areas: { set: [{ id: MOCK_IDS.AREA_1 }, { id: MOCK_IDS.AREA_2 }] },
          organization: { connect: { id: MOCK_IDS.ORG_1 } },
          role: OrganizationRole.HELPER,
          adminComment: "Admin comment",
          type: TeamType.FRANCE_SERVICE,
        },
      });
    });
  });

  describe("updateTeamAreas", () => {
    it("throws error when non-admin non-supervisor tries to update", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.updateTeamAreas({
          id: MOCK_IDS.TEAM_1,
          areaIds: [MOCK_IDS.AREA_1],
        }),
      ).rejects.toThrow(
        "Seuls les administrateurs et superviseurs peuvent modifier les territoires",
      );
    });

    it("updates team areas for admin", async () => {
      (prisma.team.update as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.updateTeamAreas({
        id: MOCK_IDS.TEAM_1,
        areaIds: [MOCK_IDS.AREA_1, MOCK_IDS.AREA_2],
      });

      expect(result).toEqual(mockTeam1);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        data: {
          areas: { set: [{ id: MOCK_IDS.AREA_1 }, { id: MOCK_IDS.AREA_2 }] },
        },
      });
    });

    it("updates team areas for supervisor within scope", async () => {
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }, { id: MOCK_IDS.AREA_2 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeam1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
      });
      (prisma.team.update as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.updateTeamAreas({
        id: MOCK_IDS.TEAM_1,
        areaIds: [MOCK_IDS.AREA_1, MOCK_IDS.AREA_2],
      });

      expect(result).toEqual(mockTeam1);
    });

    it("throws error when supervisor tries to set areas out of scope", async () => {
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeam1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(
        caller.updateTeamAreas({
          id: MOCK_IDS.TEAM_1,
          areaIds: [MOCK_IDS.AREA_1, "out-of-scope-area"],
        }),
      ).rejects.toThrow(
        "Un ou plusieurs territoires sont hors de votre périmètre superviseur",
      );
    });

    it("throws error when supervisor tries to update team outside org scope", async () => {
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: "other-org" }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeam1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(
        caller.updateTeamAreas({
          id: MOCK_IDS.TEAM_1,
          areaIds: [MOCK_IDS.AREA_1],
        }),
      ).rejects.toThrow("Équipe hors de votre périmètre superviseur");
    });
  });

  describe("deleteTeam", () => {
    const mockTeamWithMembers = {
      ...mockTeam1,
      deletedAt: null,
      areas: [{ id: MOCK_IDS.AREA_1 }],
      users: [{ id: MOCK_IDS.USER_2, firstName: "John", lastName: "Doe" }],
      managers: [{ id: MOCK_IDS.USER_2 }],
      pendingUsers: [],
      pendingManagers: [],
    };

    // --- Authorization ---

    it("throws error when non-admin non-supervisor tries to delete", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow(
        "Seuls les administrateurs et superviseurs peuvent supprimer des équipes",
      );
    });

    it("does not query prisma when user role is insufficient", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow();
      expect(prisma.team.findUnique).not.toHaveBeenCalled();
    });

    // --- Team not found / already deleted ---

    it("throws error when team not found", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow(
        "Équipe introuvable",
      );
    });

    it("throws error when team is already soft-deleted", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeamWithMembers,
        deletedAt: new Date("2024-01-01"),
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow(
        "Cette équipe est déjà supprimée",
      );
    });

    it("does not call $transaction when team is already soft-deleted", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeamWithMembers,
        deletedAt: new Date("2024-01-01"),
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // --- Admin soft delete ---

    it("soft deletes team when user is admin", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.deleteTeam(MOCK_IDS.TEAM_1);

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.team.delete).not.toHaveBeenCalled();
    });

    it("admin does not trigger supervisor scope check", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deleteTeam(MOCK_IDS.TEAM_1);

      expect(prisma.supervisor.findUnique).not.toHaveBeenCalled();
    });

    // --- Transaction content ---

    it("includes team.update with member disconnects and deletedAt in transaction", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const mockTeamUpdate = Symbol("team-update");
      (prisma.team.update as jest.Mock).mockReturnValue(mockTeamUpdate);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deleteTeam(MOCK_IDS.TEAM_1);

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        data: {
          users: { set: [] },
          managers: { set: [] },
          pendingUsers: { set: [] },
          pendingManagers: { set: [] },
          deletedAt: expect.any(Date),
        },
      });

      const transactionArgs = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionArgs).toContain(mockTeamUpdate);
    });

    // --- processTeamDeletionReports ---

    it("calls processTeamDeletionReports with team name", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deleteTeam(MOCK_IDS.TEAM_1);

      expect(processTeamDeletionReports).toHaveBeenCalledWith(
        prisma,
        MOCK_IDS.TEAM_1,
        "Team Alpha",
        MOCK_IDS.USER_1,
      );
    });

    it("uses fallback name when team has no name", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeamWithMembers,
        name: "",
      });
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deleteTeam(MOCK_IDS.TEAM_1);

      expect(processTeamDeletionReports).toHaveBeenCalledWith(
        prisma,
        MOCK_IDS.TEAM_1,
        "Équipe supprimée",
        MOCK_IDS.USER_1,
      );
    });

    it("includes operations from processTeamDeletionReports in transaction", async () => {
      const mockOp1 = Symbol("op1");
      const mockOp2 = Symbol("op2");
      (processTeamDeletionReports as jest.Mock).mockResolvedValue({
        operations: [mockOp1, mockOp2],
      });

      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deleteTeam(MOCK_IDS.TEAM_1);

      const transactionArgs = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionArgs).toContain(mockOp1);
      expect(transactionArgs).toContain(mockOp2);
    });

    it("does not call processTeamRemovalReports", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deleteTeam(MOCK_IDS.TEAM_1);

      expect(processTeamRemovalReports).not.toHaveBeenCalled();
    });

    // --- Team with pendingUsers and pendingManagers ---

    it("disconnects pendingUsers and pendingManagers in the transaction", async () => {
      const teamWithPending = {
        ...mockTeamWithMembers,
        pendingUsers: [{ id: "pending-user-1" }, { id: "pending-user-2" }],
        pendingManagers: [{ id: "pending-manager-1" }],
      };

      (prisma.team.findUnique as jest.Mock).mockResolvedValue(teamWithPending);
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deleteTeam(MOCK_IDS.TEAM_1);

      expect(prisma.team.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pendingUsers: { set: [] },
            pendingManagers: { set: [] },
          }),
        }),
      );
    });

    // --- Supervisor scope checks ---

    it("soft deletes team when supervisor is within scope", async () => {
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.deleteTeam(MOCK_IDS.TEAM_1);

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.team.delete).not.toHaveBeenCalled();
    });

    it("throws error when supervisor tries to delete team outside org scope", async () => {
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: "other-org" }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow(
        "Équipe hors de votre périmètre superviseur",
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws error when supervisor has matching org but no matching area", async () => {
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_2 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow(
        "Équipe hors de votre périmètre superviseur",
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws error when supervisor record not found", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow(
        "Périmètre superviseur introuvable",
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws when team has no areas and supervisor tries to delete", async () => {
      const teamWithNoAreas = {
        ...mockTeamWithMembers,
        areas: [],
      };
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(teamWithNoAreas);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow(
        "Équipe hors de votre périmètre superviseur",
      );
    });

    it("supervisor with multiple areas succeeds if at least one matches", async () => {
      const teamWithMultipleAreas = {
        ...mockTeamWithMembers,
        areas: [{ id: "area-other" }, { id: MOCK_IDS.AREA_1 }],
      };
      const mockSupervisor = {
        id: "supervisor-1",
        userId: MOCK_IDS.USER_1,
        areas: [{ id: MOCK_IDS.AREA_1 }, { id: MOCK_IDS.AREA_2 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      };
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(
        mockSupervisor,
      );
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        teamWithMultipleAreas,
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.deleteTeam(MOCK_IDS.TEAM_1);
      expect(result).toEqual({ success: true });
    });

    // --- Combined scenario: operations + soft delete ---

    it("includes operations from processTeamDeletionReports and team soft delete in transaction", async () => {
      const mockOp1 = Symbol("op1");
      const mockOp2 = Symbol("op2");
      const mockOp3 = Symbol("op3");
      (processTeamDeletionReports as jest.Mock).mockResolvedValue({
        operations: [mockOp1, mockOp2, mockOp3],
      });

      const mockTeamSoftDelete = Symbol("team-soft-delete");
      (prisma.team.update as jest.Mock).mockReturnValue(mockTeamSoftDelete);

      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        mockTeamWithMembers,
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.deleteTeam(MOCK_IDS.TEAM_1);

      // 3 ops from processTeamDeletionReports + 1 team soft delete
      const transactionArgs = (prisma.$transaction as jest.Mock).mock
        .calls[0][0];
      expect(transactionArgs).toHaveLength(4);
      expect(transactionArgs).toContain(mockOp1);
      expect(transactionArgs).toContain(mockOp2);
      expect(transactionArgs).toContain(mockOp3);
      expect(transactionArgs).toContain(mockTeamSoftDelete);
    });

    // --- findUnique call shape ---

    it("loads team with correct includes", async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(caller.deleteTeam(MOCK_IDS.TEAM_1)).rejects.toThrow();

      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        include: {
          areas: true,
          users: { select: { id: true, firstName: true, lastName: true } },
          managers: { select: { id: true } },
          pendingUsers: { select: { id: true } },
          pendingManagers: { select: { id: true } },
        },
      });
    });
  });

  describe("addManager", () => {
    it("throws FORBIDDEN when checkTeamModifyAccess denies access", async () => {
      (checkTeamModifyAccess as jest.Mock).mockRejectedValueOnce(
        new (jest.requireActual("@trpc/server").TRPCError)({
          code: "FORBIDDEN",
          message: "Vous devez être administrateur ou manager de cette équipe.",
        }),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.addManager({
          teamId: MOCK_IDS.TEAM_1,
          memberId: MOCK_IDS.USER_2,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it("adds a confirmed user as manager", async () => {
      const updatedTeam = { ...mockTeam1, managers: [{ id: MOCK_IDS.USER_2 }] };
      (prisma.team.update as jest.Mock).mockResolvedValue(updatedTeam);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.addManager({
        teamId: MOCK_IDS.TEAM_1,
        memberId: MOCK_IDS.USER_2,
        isPending: false,
      });

      expect(result).toEqual(updatedTeam);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        data: {
          managers: { connect: { id: MOCK_IDS.USER_2 } },
        },
      });
    });

    it("adds a pending user as pending manager", async () => {
      const pendingUserId = "pending-user-1";
      const updatedTeam = {
        ...mockTeam1,
        pendingManagers: [{ id: pendingUserId }],
      };
      (prisma.team.update as jest.Mock).mockResolvedValue(updatedTeam);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.addManager({
        teamId: MOCK_IDS.TEAM_1,
        memberId: pendingUserId,
        isPending: true,
      });

      expect(result).toEqual(updatedTeam);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        data: {
          pendingManagers: { connect: { id: pendingUserId } },
        },
      });
    });
  });

  describe("removeManager", () => {
    it("removes a confirmed user from managers when multiple managers exist", async () => {
      const teamWithManagers = {
        managers: [{ id: MOCK_IDS.USER_1 }, { id: MOCK_IDS.USER_2 }],
        pendingManagers: [],
      };
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(teamWithManagers);
      (prisma.team.update as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.removeManager({
        teamId: MOCK_IDS.TEAM_1,
        memberId: MOCK_IDS.USER_2,
        isPending: false,
      });

      expect(result).toEqual(mockTeam1);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        data: {
          managers: { disconnect: { id: MOCK_IDS.USER_2 } },
        },
      });
    });

    it("removes a pending user from pending managers when multiple managers exist", async () => {
      const pendingUserId = "pending-user-1";
      const teamWithManagers = {
        managers: [{ id: MOCK_IDS.USER_1 }],
        pendingManagers: [{ id: pendingUserId }],
      };
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(teamWithManagers);
      (prisma.team.update as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.removeManager({
        teamId: MOCK_IDS.TEAM_1,
        memberId: pendingUserId,
        isPending: true,
      });

      expect(result).toEqual(mockTeam1);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.TEAM_1 },
        data: {
          pendingManagers: { disconnect: { id: pendingUserId } },
        },
      });
    });

    it("throws error when trying to remove the last manager", async () => {
      const teamWithOneManager = {
        managers: [{ id: MOCK_IDS.USER_1 }],
        pendingManagers: [],
      };
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        teamWithOneManager,
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.removeManager({
          teamId: MOCK_IDS.TEAM_1,
          memberId: MOCK_IDS.USER_1,
          isPending: false,
        }),
      ).rejects.toThrow(
        "Impossible de retirer le dernier responsable de l'équipe",
      );

      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it("allows removing manager when pending managers exist", async () => {
      const teamWithMixedManagers = {
        managers: [{ id: MOCK_IDS.USER_1 }],
        pendingManagers: [{ id: "pending-user-1" }],
      };
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(
        teamWithMixedManagers,
      );
      (prisma.team.update as jest.Mock).mockResolvedValue(mockTeam1);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.removeManager({
        teamId: MOCK_IDS.TEAM_1,
        memberId: MOCK_IDS.USER_1,
        isPending: false,
      });

      expect(result).toEqual(mockTeam1);
      expect(prisma.team.update).toHaveBeenCalled();
    });
  });
});
