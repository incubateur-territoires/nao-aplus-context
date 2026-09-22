import {
  checkTeamManagerOrAdmin,
  checkReportAccess,
  checkTeamAccess,
  checkAdminOnly,
  checkTeamModifyAccess,
  checkOrganizationAccess,
  checkApplicantTeamAccess,
  checkManagerCreatesInOwnOrganization,
  checkCoAuthorsInApplicantTeam,
  checkTeamsInvitableForReport,
  type AuthorizationContext,
} from "./authorization";
import prisma from "@/lib/prisma";
import { USER_ROLES } from "@/constants/user-roles";
import { ReportStatus } from "@/generated/prisma/enums";
import { TRPCError } from "@trpc/server";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    team: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    report: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    supervisor: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

const createMockContext = (
  overrides?: Partial<AuthorizationContext>,
): AuthorizationContext => ({
  userId: "user-1",
  user: {
    id: "user-1",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    name: "Test User",
    role: USER_ROLES.USER,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides?.user,
  },
  ...overrides,
});

describe("Authorization Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkTeamManagerOrAdmin", () => {
    it("passes for admin user without checking team membership", async () => {
      const ctx = createMockContext({
        user: { role: USER_ROLES.ADMIN } as AuthorizationContext["user"],
      });

      await expect(
        checkTeamManagerOrAdmin(ctx, "target-user-id"),
      ).resolves.toBeUndefined();

      expect(prisma.team.findFirst).not.toHaveBeenCalled();
    });

    it("passes for lowercase 'admin' role", async () => {
      const ctx = createMockContext({
        user: { role: "admin" } as AuthorizationContext["user"],
      });

      await expect(
        checkTeamManagerOrAdmin(ctx, "target-user-id"),
      ).resolves.toBeUndefined();

      expect(prisma.team.findFirst).not.toHaveBeenCalled();
    });

    it("passes for team manager of target user's team", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({
        id: "team-1",
        name: "Team 1",
      });

      const ctx = createMockContext();

      await expect(
        checkTeamManagerOrAdmin(ctx, "target-user-id"),
      ).resolves.toBeUndefined();

      expect(prisma.team.findFirst).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          managers: { some: { id: "user-1" } },
          users: { some: { id: "target-user-id" } },
        },
      });
    });

    it("throws FORBIDDEN for non-admin non-manager", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(
        checkTeamManagerOrAdmin(ctx, "target-user-id"),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message:
          "Vous devez être administrateur ou manager de l'équipe pour effectuer cette action.",
      });
    });
  });

  describe("checkReportAccess", () => {
    beforeEach(() => {
      // Par défaut, le signalement existe et n'est pas supprimé
      (prisma.report.findUnique as jest.Mock).mockResolvedValue({
        status: ReportStatus.IN_TREATMENT,
      });
    });

    it("passes for admin user without checking report access", async () => {
      const ctx = createMockContext({
        user: { role: USER_ROLES.ADMIN } as AuthorizationContext["user"],
      });

      await expect(
        checkReportAccess(ctx, "report-id"),
      ).resolves.toBeUndefined();

      expect(prisma.report.findFirst).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND for a soft deleted report, even for an admin", async () => {
      (prisma.report.findUnique as jest.Mock).mockResolvedValue({
        status: ReportStatus.DELETED,
      });

      const ctx = createMockContext({
        user: { role: USER_ROLES.ADMIN } as AuthorizationContext["user"],
      });

      await expect(checkReportAccess(ctx, "report-id")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws NOT_FOUND when the report does not exist", async () => {
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(checkReportAccess(ctx, "report-id")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      expect(prisma.report.findFirst).not.toHaveBeenCalled();
    });

    it("passes when user is author of the report", async () => {
      (prisma.report.findFirst as jest.Mock).mockResolvedValue({
        id: "report-id",
      });

      const ctx = createMockContext();

      await expect(
        checkReportAccess(ctx, "report-id"),
      ).resolves.toBeUndefined();
    });

    it("throws FORBIDDEN when user has no access", async () => {
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(checkReportAccess(ctx, "report-id")).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Vous n'avez pas accès à ce signalement.",
      });
    });

    it("passes for supervisor when report is in scope", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: "area-1" }],
        organizations: [{ id: "org-1" }],
      });
      (prisma.report.findFirst as jest.Mock).mockResolvedValue({
        id: "report-id",
      });

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(
        checkReportAccess(ctx, "report-id"),
      ).resolves.toBeUndefined();

      expect(prisma.supervisor.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        select: {
          areas: { select: { id: true } },
          organizations: { select: { id: true } },
        },
      });
      expect(prisma.report.findFirst).toHaveBeenCalledWith({
        where: {
          id: "report-id",
          areaId: { in: ["area-1"] },
          OR: [
            { applicantTeam: { organizationId: { in: ["org-1"] } } },
            {
              requestedTeams: {
                some: { organizationId: { in: ["org-1"] } },
              },
            },
          ],
        },
        select: { id: true },
      });
    });

    it("throws FORBIDDEN for supervisor when report is out of scope", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: "area-1" }],
        organizations: [{ id: "org-1" }],
      });
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(checkReportAccess(ctx, "report-id")).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Vous n'avez pas accès à ce signalement.",
      });
    });

    it("throws FORBIDDEN for supervisor without supervisor record", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(checkReportAccess(ctx, "report-id")).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Vous n'avez pas accès à ce signalement.",
      });

      expect(prisma.report.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("checkTeamAccess", () => {
    it("passes for admin user without checking team membership", async () => {
      const ctx = createMockContext({
        user: { role: USER_ROLES.ADMIN } as AuthorizationContext["user"],
      });

      await expect(checkTeamAccess(ctx, "team-id")).resolves.toBeUndefined();

      expect(prisma.team.findFirst).not.toHaveBeenCalled();
    });

    it("passes for team member", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({
        id: "team-id",
      });

      const ctx = createMockContext();

      await expect(checkTeamAccess(ctx, "team-id")).resolves.toBeUndefined();

      expect(prisma.team.findFirst).toHaveBeenCalledWith({
        where: {
          id: "team-id",
          deletedAt: null,
          OR: [
            { users: { some: { id: "user-1" } } },
            { managers: { some: { id: "user-1" } } },
          ],
        },
      });
    });

    it("throws FORBIDDEN for non-member", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(checkTeamAccess(ctx, "team-id")).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Vous n'avez pas accès à cette équipe.",
      });
    });

    it("passes for supervisor when team is in scope", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: "area-1" }],
        organizations: [{ id: "org-1" }],
      });
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({
        id: "team-id",
      });

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(checkTeamAccess(ctx, "team-id")).resolves.toBeUndefined();

      expect(prisma.team.findFirst).toHaveBeenCalledWith({
        where: {
          id: "team-id",
          deletedAt: null,
          organizationId: { in: ["org-1"] },
          areas: { some: { id: { in: ["area-1"] } } },
        },
      });
    });

    it("throws FORBIDDEN for supervisor when team is out of scope and they are not a member", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: "area-1" }],
        organizations: [{ id: "org-1" }],
      });
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(checkTeamAccess(ctx, "team-id")).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Vous n'avez pas accès à cette équipe.",
      });
    });

    it("passes for supervisor who is member of a team outside their scope", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: "area-1" }],
        organizations: [{ id: "org-1" }],
      });
      (prisma.team.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // hors périmètre organisation + areas
        .mockResolvedValueOnce({ id: "team-id" }); // mais membre de l'équipe

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(checkTeamAccess(ctx, "team-id")).resolves.toBeUndefined();

      expect(prisma.team.findFirst).toHaveBeenLastCalledWith({
        where: {
          id: "team-id",
          deletedAt: null,
          OR: [
            { users: { some: { id: "user-1" } } },
            { managers: { some: { id: "user-1" } } },
          ],
        },
      });
    });

    it("throws FORBIDDEN for supervisor without supervisor record who is not a member", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(checkTeamAccess(ctx, "team-id")).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Vous n'avez pas accès à cette équipe.",
      });
    });
  });

  describe("checkAdminOnly", () => {
    it("passes for admin user", () => {
      const ctx = createMockContext({
        user: { role: USER_ROLES.ADMIN } as AuthorizationContext["user"],
      });

      expect(() => checkAdminOnly(ctx)).not.toThrow();
    });

    it("passes for lowercase 'admin' role", () => {
      const ctx = createMockContext({
        user: { role: "admin" } as AuthorizationContext["user"],
      });

      expect(() => checkAdminOnly(ctx)).not.toThrow();
    });

    it("throws FORBIDDEN for non-admin user", () => {
      const ctx = createMockContext();

      expect(() => checkAdminOnly(ctx)).toThrow(TRPCError);
      expect(() => checkAdminOnly(ctx)).toThrow(
        "Vous devez être administrateur pour effectuer cette action.",
      );
    });

    it("throws FORBIDDEN for user with lowercase 'user' role", () => {
      const ctx = createMockContext({
        user: { role: "user" } as AuthorizationContext["user"],
      });

      expect(() => checkAdminOnly(ctx)).toThrow(TRPCError);
    });
  });

  describe("checkTeamModifyAccess", () => {
    it("passes for admin user without checking team manager", async () => {
      const ctx = createMockContext({
        user: { role: USER_ROLES.ADMIN } as AuthorizationContext["user"],
      });

      await expect(
        checkTeamModifyAccess(ctx, "team-id"),
      ).resolves.toBeUndefined();

      expect(prisma.team.findFirst).not.toHaveBeenCalled();
    });

    it("passes for team manager", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({
        id: "team-id",
      });

      const ctx = createMockContext();

      await expect(
        checkTeamModifyAccess(ctx, "team-id"),
      ).resolves.toBeUndefined();

      expect(prisma.team.findFirst).toHaveBeenCalledWith({
        where: {
          id: "team-id",
          deletedAt: null,
          managers: { some: { id: "user-1" } },
        },
      });
    });

    it("throws FORBIDDEN for non-admin non-manager", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(checkTeamModifyAccess(ctx, "team-id")).rejects.toMatchObject(
        {
          code: "FORBIDDEN",
          message: "Vous devez être administrateur ou manager de cette équipe.",
        },
      );
    });

    it("passes for supervisor when team is in scope", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: "area-1" }],
        organizations: [{ id: "org-1" }],
      });
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({
        id: "team-id",
      });

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(
        checkTeamModifyAccess(ctx, "team-id"),
      ).resolves.toBeUndefined();

      expect(prisma.team.findFirst).toHaveBeenCalledWith({
        where: {
          id: "team-id",
          deletedAt: null,
          organizationId: { in: ["org-1"] },
          areas: { some: { id: { in: ["area-1"] } } },
        },
      });
    });

    it("throws FORBIDDEN for supervisor when team is out of scope and they are not a manager", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: "area-1" }],
        organizations: [{ id: "org-1" }],
      });
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(checkTeamModifyAccess(ctx, "team-id")).rejects.toMatchObject(
        {
          code: "FORBIDDEN",
          message: "Vous devez être administrateur ou manager de cette équipe.",
        },
      );
    });

    it("passes for supervisor who manages a team outside their scope", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: "area-1" }],
        organizations: [{ id: "org-1" }],
      });
      (prisma.team.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // hors périmètre organisation + areas
        .mockResolvedValueOnce({ id: "team-id" }); // mais manager de l'équipe

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(
        checkTeamModifyAccess(ctx, "team-id"),
      ).resolves.toBeUndefined();

      expect(prisma.team.findFirst).toHaveBeenLastCalledWith({
        where: {
          id: "team-id",
          managers: { some: { id: "user-1" } },
          deletedAt: null,
        },
      });
    });

    it("throws FORBIDDEN for supervisor without supervisor record who is not a manager", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext({
        user: {
          role: USER_ROLES.SUPERVISOR,
        } as AuthorizationContext["user"],
      });

      await expect(checkTeamModifyAccess(ctx, "team-id")).rejects.toMatchObject(
        {
          code: "FORBIDDEN",
        },
      );
    });
  });

  describe("checkOrganizationAccess", () => {
    it("passes for admin without querying", async () => {
      const ctx = createMockContext({
        user: { role: USER_ROLES.ADMIN } as AuthorizationContext["user"],
      });

      await expect(
        checkOrganizationAccess(ctx, "org-1"),
      ).resolves.toBeUndefined();

      expect(prisma.team.findFirst).not.toHaveBeenCalled();
      expect(prisma.supervisor.findFirst).not.toHaveBeenCalled();
    });

    it("passes for supervisor when organization is in scope", async () => {
      (prisma.supervisor.findFirst as jest.Mock).mockResolvedValue({
        id: "supervisor-1",
      });

      const ctx = createMockContext({
        user: { role: USER_ROLES.SUPERVISOR } as AuthorizationContext["user"],
      });

      await expect(
        checkOrganizationAccess(ctx, "org-1"),
      ).resolves.toBeUndefined();
    });

    it("throws FORBIDDEN for supervisor when organization is out of scope", async () => {
      (prisma.supervisor.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext({
        user: { role: USER_ROLES.SUPERVISOR } as AuthorizationContext["user"],
      });

      await expect(checkOrganizationAccess(ctx, "org-1")).rejects.toMatchObject(
        { code: "FORBIDDEN" },
      );
    });

    it("passes for a member of a team of the organization", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({ id: "team-1" });

      const ctx = createMockContext();

      await expect(
        checkOrganizationAccess(ctx, "org-1"),
      ).resolves.toBeUndefined();
    });

    it("throws FORBIDDEN for a user with no team in the organization", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(checkOrganizationAccess(ctx, "org-1")).rejects.toMatchObject(
        { code: "FORBIDDEN" },
      );
    });
  });

  describe("checkApplicantTeamAccess", () => {
    it("passes for a member of the applicant team without looking at reports", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({ id: "team-1" });

      const ctx = createMockContext();

      await expect(
        checkApplicantTeamAccess(ctx, "team-1"),
      ).resolves.toBeUndefined();

      expect(prisma.report.findFirst).not.toHaveBeenCalled();
    });

    it("passes for a recipient of a report emitted by the applicant team", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.report.findFirst as jest.Mock).mockResolvedValue({
        id: "report-1",
      });

      const ctx = createMockContext();

      await expect(
        checkApplicantTeamAccess(ctx, "team-1"),
      ).resolves.toBeUndefined();
    });

    it("throws FORBIDDEN for a user with no link to the applicant team", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(
        checkApplicantTeamAccess(ctx, "team-1"),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("excludes deleted reports from the recipient fallback", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.report.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(
        checkApplicantTeamAccess(ctx, "team-1"),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(prisma.report.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            applicantTeamId: "team-1",
            status: { not: ReportStatus.DELETED },
          }),
        }),
      );
    });
  });

  describe("checkManagerCreatesInOwnOrganization", () => {
    it("passes when the user manages a team in the organization", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({ id: "team-1" });

      const ctx = createMockContext();

      await expect(
        checkManagerCreatesInOwnOrganization(ctx, "org-1"),
      ).resolves.toBeUndefined();

      expect(prisma.team.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            managers: { some: { id: "user-1" } },
            deletedAt: null,
          }),
        }),
      );
    });

    it("throws FORBIDDEN when the user manages no team in the organization", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(
        checkManagerCreatesInOwnOrganization(ctx, "org-1"),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("ignores deleted teams when checking the organization", async () => {
      (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const ctx = createMockContext();

      await expect(
        checkManagerCreatesInOwnOrganization(ctx, "org-1"),
      ).rejects.toBeInstanceOf(TRPCError);

      expect(prisma.team.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  describe("checkCoAuthorsInApplicantTeam", () => {
    it("passes when every coAuthor belongs to the applicant team", async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(2);

      await expect(
        checkCoAuthorsInApplicantTeam("team-1", ["user-2", "user-3"]),
      ).resolves.toBeUndefined();

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          id: { in: ["user-2", "user-3"] },
          teams: { some: { id: "team-1" } },
        },
      });
    });

    it("passes without querying when the list is empty", async () => {
      await expect(
        checkCoAuthorsInApplicantTeam("team-1", []),
      ).resolves.toBeUndefined();

      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it("throws FORBIDDEN when a coAuthor is outside the applicant team", async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      await expect(
        checkCoAuthorsInApplicantTeam("team-1", ["user-2", "attacker"]),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("is not fooled by duplicated ids", async () => {
      // 2 lignes comptées pour 2 ids… mais c'est deux fois le même membre :
      // le doublon ne doit pas couvrir un id étranger.
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      await expect(
        checkCoAuthorsInApplicantTeam("team-1", ["user-2", "user-2"]),
      ).resolves.toBeUndefined();
    });
  });

  describe("checkTeamsInvitableForReport", () => {
    const reportScope = {
      areaId: "area-1",
      applicantTeamType: "FRANCE_SERVICE",
    } as Parameters<typeof checkTeamsInvitableForReport>[0];

    it("passes when every team matches the invitable conditions", async () => {
      (prisma.team.count as jest.Mock).mockResolvedValue(2);

      await expect(
        checkTeamsInvitableForReport(reportScope, ["team-2", "team-3"]),
      ).resolves.toBeUndefined();

      expect(prisma.team.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { in: ["team-2", "team-3"] },
          areas: { some: { id: "area-1" } },
          role: "OPERATOR",
          users: { some: {} },
          acceptTypes: { has: "FRANCE_SERVICE" },
          deletedAt: null,
        }),
      });
    });

    it("passes without querying when the list is empty", async () => {
      await expect(
        checkTeamsInvitableForReport(reportScope, []),
      ).resolves.toBeUndefined();

      expect(prisma.team.count).not.toHaveBeenCalled();
    });

    it("throws FORBIDDEN when a team does not match (deleted, helper, off-territory…)", async () => {
      (prisma.team.count as jest.Mock).mockResolvedValue(1);

      await expect(
        checkTeamsInvitableForReport(reportScope, ["team-2", "forged-team"]),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
