import { TRPCError } from "@trpc/server";
import prisma from "@/lib/prisma";
import { USER_ROLES } from "@/constants/user-roles";
import {
  OrganizationRole,
  ReportStatus,
  type TeamType,
} from "@/generated/prisma/enums";
import type { ExtendedUser } from "../init";

export interface AuthorizationContext {
  userId: string;
  user: ExtendedUser;
}

/**
 * Check if user is admin or manager of a team that includes the target user.
 * Throws FORBIDDEN if not authorized.
 */
export async function checkTeamManagerOrAdmin(
  ctx: AuthorizationContext,
  targetUserId: string,
): Promise<void> {
  const isAdmin = ctx.user.role === USER_ROLES.ADMIN;

  if (isAdmin) return;

  const isManagerOfTeam = await prisma.team.findFirst({
    where: {
      managers: { some: { id: ctx.userId } },
      users: { some: { id: targetUserId } },
      deletedAt: null,
    },
  });

  if (!isManagerOfTeam) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Vous devez être administrateur ou manager de l'équipe pour effectuer cette action.",
    });
  }
}

/**
 * Check if user can access a specific report.
 * Throws FORBIDDEN if not authorized.
 */
export async function checkReportAccess(
  ctx: AuthorizationContext,
  reportId: string,
): Promise<void> {
  // Un signalement supprimé (soft delete) est introuvable pour tout le monde,
  // administrateurs compris : ni consultation, ni réponse, ni invitation d'équipe.
  const existingReport = await prisma.report.findUnique({
    where: { id: reportId },
    select: { status: true },
  });

  if (!existingReport || existingReport.status === ReportStatus.DELETED) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Ce signalement n'existe pas ou a été supprimé.",
    });
  }

  const isAdmin = ctx.user.role === USER_ROLES.ADMIN;

  if (isAdmin) return;

  if (ctx.user.role === USER_ROLES.SUPERVISOR) {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: ctx.userId },
      select: {
        areas: { select: { id: true } },
        organizations: { select: { id: true } },
      },
    });

    if (!supervisor) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Vous n'avez pas accès à ce signalement.",
      });
    }

    const areaIds = supervisor.areas.map((a) => a.id);
    const orgIds = supervisor.organizations.map((o) => o.id);

    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        areaId: { in: areaIds },
        OR: [
          { applicantTeam: { organizationId: { in: orgIds } } },
          { requestedTeams: { some: { organizationId: { in: orgIds } } } },
        ],
      },
      select: { id: true },
    });

    if (!report) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Vous n'avez pas accès à ce signalement.",
      });
    }

    return;
  }

  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      OR: [
        { authorId: ctx.userId },
        { coAuthors: { some: { id: ctx.userId } } },
        { requestedTeams: { some: { users: { some: { id: ctx.userId } } } } },
        { applicantTeam: { users: { some: { id: ctx.userId } } } },
      ],
    },
    select: { id: true },
  });

  if (!report) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous n'avez pas accès à ce signalement.",
    });
  }
}

/**
 * Check if user is admin only.
 * Throws FORBIDDEN if not authorized.
 */
export function checkAdminOnly(ctx: AuthorizationContext): void {
  if (ctx.user.role !== USER_ROLES.ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous devez être administrateur pour effectuer cette action.",
    });
  }
}

/**
 * Check if user can manage pending users (admin, supervisor, or manager).
 * Returns team IDs to filter by, or null if admin (no filter needed).
 * Throws FORBIDDEN if not authorized.
 */
export async function checkCanManagePendingUsers(
  ctx: AuthorizationContext,
): Promise<string[] | null> {
  if (ctx.user.role === USER_ROLES.ADMIN) return null;

  if (ctx.user.role === USER_ROLES.SUPERVISOR) {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: ctx.userId },
      select: {
        areas: { select: { id: true } },
        organizations: { select: { id: true } },
      },
    });

    if (!supervisor) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Vous devez être administrateur, superviseur ou responsable d'équipe pour effectuer cette action.",
      });
    }

    const areaIds = supervisor.areas.map((a) => a.id);
    const orgIds = supervisor.organizations.map((o) => o.id);

    const teams = await prisma.team.findMany({
      where: {
        deletedAt: null,
        organizationId: { in: orgIds },
        areas: { some: { id: { in: areaIds } } },
      },
      select: { id: true },
    });

    return teams.map((t) => t.id);
  }

  // Regular user: must be manager of at least one team
  const managedTeams = await prisma.team.findMany({
    where: {
      managers: { some: { id: ctx.userId } },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (managedTeams.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Vous devez être administrateur, superviseur ou responsable d'équipe pour effectuer cette action.",
    });
  }

  return managedTeams.map((t) => t.id);
}

/**
 * Vérifie si un utilisateur peut accéder aux fichiers d'un signalement.
 * Contrairement à checkReportAccess, les admins n'ont PAS d'accès automatique.
 * Seuls les utilisateurs directement liés au signalement sont autorisés.
 */
export async function canAccessReportFiles(
  userId: string,
  reportId: string,
): Promise<boolean> {
  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      OR: [
        { authorId: userId },
        { coAuthors: { some: { id: userId } } },
        { requestedTeams: { some: { users: { some: { id: userId } } } } },
        { applicantTeam: { users: { some: { id: userId } } } },
      ],
    },
    select: { id: true },
  });

  return report !== null;
}

/**
 * Whether the user can access a specific team (read access).
 * Admin: full access.
 * Supervisor: team in their scope (organization + areas), ou équipe dont il est
 * membre/manager — une équipe « pilote national » n'est pas forcément rattachée
 * aux territoires du périmètre du superviseur.
 * Standard user: must be a member or manager of the team.
 */
export async function hasTeamAccess(
  ctx: AuthorizationContext,
  teamId: string,
): Promise<boolean> {
  if (ctx.user.role === USER_ROLES.ADMIN) return true;

  if (ctx.user.role === USER_ROLES.SUPERVISOR) {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: ctx.userId },
      select: {
        areas: { select: { id: true } },
        organizations: { select: { id: true } },
      },
    });

    if (supervisor) {
      const areaIds = supervisor.areas.map((a) => a.id);
      const orgIds = supervisor.organizations.map((o) => o.id);

      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          deletedAt: null,
          organizationId: { in: orgIds },
          areas: { some: { id: { in: areaIds } } },
        },
      });

      if (team) return true;
    }
  }

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      deletedAt: null,
      OR: [
        { users: { some: { id: ctx.userId } } },
        { managers: { some: { id: ctx.userId } } },
      ],
    },
  });

  return team !== null;
}

/**
 * Check if user can access a specific team (read access).
 * Throws FORBIDDEN if not authorized.
 */
export async function checkTeamAccess(
  ctx: AuthorizationContext,
  teamId: string,
): Promise<void> {
  if (!(await hasTeamAccess(ctx, teamId))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous n'avez pas accès à cette équipe.",
    });
  }
}

/**
 * Check if user can browse an organization (its teams, its directory).
 * Admin: full access.
 * Supervisor: organization must be in their scope.
 * Standard user: must belong to (or manage) a team of that organization.
 * Throws FORBIDDEN if not authorized.
 */
export async function checkOrganizationAccess(
  ctx: AuthorizationContext,
  organizationId: string,
): Promise<void> {
  if (ctx.user.role === USER_ROLES.ADMIN) return;

  if (ctx.user.role === USER_ROLES.SUPERVISOR) {
    const supervisor = await prisma.supervisor.findFirst({
      where: {
        userId: ctx.userId,
        organizations: { some: { id: organizationId } },
      },
      select: { id: true },
    });

    if (supervisor) return;

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous n'avez pas accès à cette organisation.",
    });
  }

  const team = await prisma.team.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      OR: [
        { users: { some: { id: ctx.userId } } },
        { managers: { some: { id: ctx.userId } } },
      ],
    },
    select: { id: true },
  });

  if (!team) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous n'avez pas accès à cette organisation.",
    });
  }
}

/**
 * Check if user can list the operator teams mobilisables for a given applicant team.
 * Two legitimate contexts: creating a report on behalf of one of one's own teams,
 * or being a recipient of a report emitted by that applicant team (reorientation).
 * Throws FORBIDDEN if not authorized.
 */
export async function checkApplicantTeamAccess(
  ctx: AuthorizationContext,
  applicantTeamId: string,
): Promise<void> {
  if (await hasTeamAccess(ctx, applicantTeamId)) return;

  const linkedReport = await prisma.report.findFirst({
    where: {
      applicantTeamId,
      status: { not: ReportStatus.DELETED },
      OR: [
        { authorId: ctx.userId },
        { coAuthors: { some: { id: ctx.userId } } },
        { requestedTeams: { some: { users: { some: { id: ctx.userId } } } } },
      ],
    },
    select: { id: true },
  });

  if (!linkedReport) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous n'avez pas accès à cette équipe.",
    });
  }
}

/**
 * Check if user can deactivate a target user.
 * Admin: full access.
 * Supervisor: target user must be in their scope (organization + areas).
 * Manager: must manage a team that includes the target user.
 * Throws FORBIDDEN if not authorized.
 */
export async function checkCanDeactivateUser(
  ctx: AuthorizationContext,
  targetUserId: string,
): Promise<void> {
  if (ctx.user.role === USER_ROLES.ADMIN) return;

  if (ctx.user.role === USER_ROLES.SUPERVISOR) {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: ctx.userId },
      include: { areas: true, organizations: true },
    });

    if (!supervisor) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Périmètre superviseur introuvable",
      });
    }

    const areaIds = supervisor.areas.map((a) => a.id);
    const orgIds = supervisor.organizations.map((o) => o.id);

    const userInScope = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        teams: {
          some: {
            organizationId: { in: orgIds },
            areas: { some: { id: { in: areaIds } } },
            deletedAt: null,
          },
        },
      },
    });

    if (!userInScope) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Utilisateur hors de votre périmètre.",
      });
    }

    return;
  }

  // For regular users: must be manager of a team that includes the target
  await checkTeamManagerOrAdmin(ctx, targetUserId);
}

/**
 * Check if user can modify a team (admin, supervisor in scope, or team manager).
 * Throws FORBIDDEN if not authorized.
 */
export async function checkTeamModifyAccess(
  ctx: AuthorizationContext,
  teamId: string,
): Promise<void> {
  const isAdmin = ctx.user.role === USER_ROLES.ADMIN;

  if (isAdmin) return;

  if (ctx.user.role === USER_ROLES.SUPERVISOR) {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: ctx.userId },
      select: {
        areas: { select: { id: true } },
        organizations: { select: { id: true } },
      },
    });

    if (supervisor) {
      const areaIds = supervisor.areas.map((a) => a.id);
      const orgIds = supervisor.organizations.map((o) => o.id);

      const teamInScope = await prisma.team.findFirst({
        where: {
          id: teamId,
          deletedAt: null,
          organizationId: { in: orgIds },
          areas: { some: { id: { in: areaIds } } },
        },
      });

      if (teamInScope) return;
    }
    // Hors périmètre : un superviseur peut quand même être manager de l'équipe
    // (cas « pilote national »), on retombe sur le contrôle manager ci-dessous.
  }

  const isManager = await prisma.team.findFirst({
    where: {
      id: teamId,
      managers: { some: { id: ctx.userId } },
      deletedAt: null,
    },
  });

  if (!isManager) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous devez être administrateur ou manager de cette équipe.",
    });
  }
}

/**
 * Un manager (ni admin ni superviseur) ne peut créer une équipe que dans une
 * organisation où il gère déjà une équipe. Sans cette borne, n'importe quel
 * manager pourrait créer une équipe au nom d'une organisation opératrice
 * (CAF, CPAM…) et apparaître dans les listes d'adressage des signalements.
 * Throws FORBIDDEN if not authorized.
 */
export async function checkManagerCreatesInOwnOrganization(
  ctx: AuthorizationContext,
  organizationId: string,
): Promise<void> {
  const managedTeamInOrganization = await prisma.team.findFirst({
    where: {
      organizationId,
      managers: { some: { id: ctx.userId } },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!managedTeamInOrganization) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Vous ne pouvez créer une équipe que dans une organisation où vous gérez déjà une équipe.",
    });
  }
}

/**
 * Un co-auteur est un membre de l'équipe à l'origine du signalement — même
 * règle qu'à la création (`createReport`). Sans elle, un participant pourrait
 * ouvrir le dossier (données citoyen et fichiers compris) à n'importe quel
 * compte de la plateforme. Throws FORBIDDEN if not satisfied.
 */
export async function checkCoAuthorsInApplicantTeam(
  applicantTeamId: string,
  coAuthorIds: string[],
): Promise<void> {
  if (coAuthorIds.length === 0) return;

  const memberCount = await prisma.user.count({
    where: {
      id: { in: coAuthorIds },
      teams: { some: { id: applicantTeamId } },
    },
  });

  if (memberCount !== new Set(coAuthorIds).size) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Un co-auteur doit être membre de l'équipe à l'origine du signalement.",
    });
  }
}

/**
 * Les équipes destinataires d'un signalement doivent remplir les mêmes
 * conditions que la liste des équipes invitables
 * (`team.getNotInvitedTeamsByReportId`) : opératrices, actives, non
 * supprimées, sur le territoire du signalement et acceptant le type de
 * l'équipe applicante. Revalidé côté serveur parce que la liste n'est qu'une
 * aide de saisie, pas une garantie. Throws FORBIDDEN if not satisfied.
 */
export async function checkTeamsInvitableForReport(
  report: { areaId: string; applicantTeamType: TeamType },
  teamIds: string[],
): Promise<void> {
  if (teamIds.length === 0) return;

  const invitableCount = await prisma.team.count({
    where: {
      id: { in: teamIds },
      areas: { some: { id: report.areaId } },
      role: OrganizationRole.OPERATOR,
      users: { some: {} },
      acceptTypes: { has: report.applicantTeamType },
      deletedAt: null,
    },
  });

  if (invitableCount !== new Set(teamIds).size) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Une ou plusieurs équipes ne peuvent pas être destinataires de ce signalement.",
    });
  }
}

/**
 * Vérifie qu'une équipe est dans le périmètre d'un superviseur : son
 * organisation ET au moins un de ses territoires. Même règle que
 * `deleteTeam` et `updateTeamAreas`. Throws FORBIDDEN if out of scope.
 */
export async function checkSupervisorScopeForTeam(
  ctx: AuthorizationContext,
  teamId: string,
): Promise<void> {
  const supervisor = await prisma.supervisor.findUnique({
    where: { userId: ctx.userId },
    select: {
      areas: { select: { id: true } },
      organizations: { select: { id: true } },
    },
  });
  if (!supervisor) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Périmètre superviseur introuvable",
    });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { organizationId: true, areas: { select: { id: true } } },
  });
  if (!team) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Équipe introuvable" });
  }

  const allowedOrgIds = new Set(supervisor.organizations.map((o) => o.id));
  const allowedAreaIds = new Set(supervisor.areas.map((a) => a.id));
  const hasAreaInScope = team.areas.some((area) => allowedAreaIds.has(area.id));

  if (!allowedOrgIds.has(team.organizationId) || !hasAreaInScope) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Équipe hors de votre périmètre superviseur",
    });
  }
}
