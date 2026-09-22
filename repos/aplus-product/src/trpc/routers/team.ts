import {
  OrganizationRole,
  ReportStatus,
  TeamType,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { USER_ROLES } from "@/constants/user-roles";
import prisma from "@/lib/prisma";
import { z } from "zod";

import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, createTRPCRouter } from "../init";
import {
  searchTeamsWithUnaccent,
  buildTeamSearchConditions,
} from "@/utils/search";
import { userIsManager } from "@/utils/role";
import { createVerificationToken } from "@/utils/verification-token";
import { normalizeEmail } from "@/utils/normalize";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { ROUTE } from "@/app/constant/route";
import {
  processTeamRemovalReports,
  processTeamDeletionReports,
  previewTeamDeletionReports,
} from "@/app/services/user/user-team-removal";
import {
  checkApplicantTeamAccess,
  checkManagerCreatesInOwnOrganization,
  checkOrganizationAccess,
  checkReportAccess,
  checkSupervisorScopeForTeam,
  checkTeamAccess,
  checkTeamModifyAccess,
} from "../middleware/authorization";
import {
  getMaskingRole,
  maskReportsForRole,
} from "@/utils/mask-sensitive-data";

export const teamRouter = createTRPCRouter({
  getTeams: adminProcedure.query(async () => {
    return prisma.team.findMany({ where: { deletedAt: null } });
  }),

  getTeamMembersActivity: protectedProcedure
    .input(z.string())
    .query(async ({ input: teamId, ctx }) => {
      await checkTeamAccess(ctx, teamId);
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: {
          id: true,
          role: true,
          users: {
            select: {
              id: true,
              createdAt: true,
            },
          },
        },
      });

      if (!team) {
        return {};
      }

      const userIds = team.users.map((u) => u.id);

      // Les signalements supprimés (soft delete) sont exclus de tous les compteurs
      const notDeleted = { status: { not: ReportStatus.DELETED } };

      // Signalements: reports authored by user on behalf of this team
      const authoredCounts = await prisma.report.groupBy({
        by: ["authorId"],
        where: {
          authorId: { in: userIds },
          applicantTeamId: teamId,
          ...notDeleted,
        },
        _count: { id: true },
      });

      // Sollicitations: reports received by team after user joined
      const sollicitationCounts = await Promise.all(
        team.users.map(async (user) => {
          const count = await prisma.report.count({
            where: {
              requestedTeams: { some: { id: teamId } },
              createdAt: { gte: user.createdAt },
              ...notDeleted,
            },
          });
          return { userId: user.id, count };
        }),
      );

      // Participations: distinct reports linked to this team where user posted a non-metadata answer
      const participationCounts = await Promise.all(
        userIds.map(async (userId) => {
          const answers = await prisma.answer.findMany({
            where: {
              authorId: userId,
              isMetadataOnly: false,
              report: {
                ...notDeleted,
                OR: [
                  { applicantTeamId: teamId },
                  { requestedTeams: { some: { id: teamId } } },
                ],
              },
            },
            select: { reportId: true },
            distinct: ["reportId"],
          });
          return { authorId: userId, count: answers.length };
        }),
      );

      // Build result map
      const result: Record<
        string,
        { signalements: number; sollicitations: number; participations: number }
      > = {};

      for (const userId of userIds) {
        const authored =
          authoredCounts.find((c) => c.authorId === userId)?._count.id ?? 0;
        const sollicitations =
          sollicitationCounts.find((c) => c.userId === userId)?.count ?? 0;
        const participations =
          participationCounts.find((c) => c.authorId === userId)?.count ?? 0;

        result[userId] = {
          signalements: authored,
          sollicitations,
          participations,
        };
      }

      return result;
    }),

  getTeamById: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      await checkTeamAccess(ctx, input);
      // Sélections minimales : les lignes User complètes (téléphone, notes
      // internes) et surtout les Report complets (données citoyens) des
      // membres n'ont rien à faire dans la fiche équipe. Seules les dates
      // de création des signalements servent, pour la dernière activité.
      return prisma.team.findUnique({
        where: { id: input, deletedAt: null },
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
    }),
  getExistingTeamsByOrganizationAndAreas: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        areaIds: z.array(z.string()),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (!input.organizationId || input.areaIds.length === 0) {
        return [];
      }
      await checkOrganizationAccess(ctx, input.organizationId);
      return prisma.team.findMany({
        where: {
          organizationId: input.organizationId,
          areas: { some: { id: { in: input.areaIds } } },
          deletedAt: null,
        },
        include: {
          areas: true,
          organization: true,
        },
      });
    }),

  // get not invited teams (only operator teams) in same report id (so same areaId)
  getNotInvitedTeamsByReportId: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ input, ctx }) => {
      await checkReportAccess(ctx, input.reportId);
      const report = await prisma.report.findUnique({
        where: { id: input.reportId },
        include: {
          area: true,
          requestedTeams: true,
          applicantTeam: { select: { type: true } },
        },
      });
      if (!report) {
        return [];
      }
      return prisma.team.findMany({
        where: {
          areas: { some: { id: report.areaId } },
          role: OrganizationRole.OPERATOR,
          id: { not: { in: report.requestedTeams.map((team) => team.id) } },
          users: {
            some: {},
          },
          acceptTypes: { has: report.applicantTeam.type },
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
    }),
  // Get teams with OPERATOR role that have at least one user and cover the given areas
  getActiveOperatorTeamsByAreaIds: protectedProcedure
    .input(
      z.object({
        areaIds: z.array(z.string()),
        applicantTeamId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      await checkApplicantTeamAccess(ctx, input.applicantTeamId);
      const applicantTeam = await prisma.team.findUnique({
        where: { id: input.applicantTeamId },
        select: { type: true },
      });
      if (!applicantTeam) return [];

      return prisma.team.findMany({
        where: {
          areas: { some: { id: { in: input.areaIds } } },
          role: OrganizationRole.OPERATOR,
          users: {
            some: {},
          },
          acceptTypes: { has: applicantTeam.type },
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
    }),
  getMyTeams: protectedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).optional(),
          pageSize: z.number().min(1).max(100).optional(),
          search: z.string().optional(),
          sortBy: z
            .enum(["name", "territoire", "organisation", "registrationNumber"])
            .optional(),
          sortOrder: z.enum(["asc", "desc"]).optional(),
          areaIds: z.array(z.string()).optional(),
          organizationIds: z.array(z.string()).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // ctx.userId is guaranteed by protectedProcedure
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 10;
      const search = input?.search?.trim();
      const sortBy = input?.sortBy;
      const sortOrder = input?.sortOrder ?? "asc";
      const filterAreaIds = input?.areaIds ?? [];
      const filterOrgIds = input?.organizationIds ?? [];
      const hasFilters = filterAreaIds.length > 0 || filterOrgIds.length > 0;

      // Tri par requête SQL raw pour gérer TRIM/LOWER sur les noms
      async function getSortedTeamIds(
        whereClause: string,
        whereParams: unknown[],
      ) {
        // Append user-selected filters (areaIds / organizationIds) as additional AND conditions
        let filterSQL = "";
        const filterParams: unknown[] = [];
        let nextParam = whereParams.length + 1;
        if (filterOrgIds.length > 0) {
          const ps = filterOrgIds.map(() => `$${nextParam++}`).join(", ");
          filterSQL += ` AND t."organizationId" IN (${ps})`;
          filterParams.push(...filterOrgIds);
        }
        if (filterAreaIds.length > 0) {
          const ps = filterAreaIds.map(() => `$${nextParam++}`).join(", ");
          filterSQL += ` AND EXISTS (SELECT 1 FROM "_AreaToTeam" atf WHERE atf."B" = t."id" AND atf."A" IN (${ps}))`;
          filterParams.push(...filterAreaIds);
        }
        whereClause = whereClause + filterSQL;
        whereParams = [...whereParams, ...filterParams];
        const dir = sortOrder === "desc" ? "DESC" : "ASC";
        // Ignore les préfixes entre crochets (ex. "[A+] ") en début de nom
        // pour que le tri reflète le vrai nom métier.
        const stripPrefix = (col: string) =>
          `regexp_replace(${col}, '^\\s*\\[[^\\]]*\\]\\s*', '')`;
        let orderClause: string;
        let joinClause = "";
        switch (sortBy) {
          case "name":
            // Les équipes préfixées par "[…]" (ex. [A+]) sont regroupées en tête
            orderClause = `CASE WHEN t."name" ~ '^\\s*\\[' THEN 0 ELSE 1 END ${dir}, LOWER(TRIM(${stripPrefix(`t."name"`)})) ${dir}`;
            break;
          case "organisation":
            joinClause = `LEFT JOIN "Organization" o ON t."organizationId" = o."id"`;
            orderClause = `LOWER(TRIM(${stripPrefix(`o."name"`)})) ${dir}`;
            break;
          case "territoire":
            joinClause = `LEFT JOIN "_AreaToTeam" at2 ON at2."B" = t."id" LEFT JOIN "Area" a ON a."id" = at2."A"`;
            orderClause = `MIN(LOWER(TRIM(${stripPrefix(`a."name"`)}))) ${dir}`;
            break;
          case "registrationNumber":
            orderClause = `CASE WHEN t."registrationNumber" ~ '^[0-9]+$' THEN CAST(t."registrationNumber" AS INTEGER) ELSE 2147483647 END ${dir}, LOWER(TRIM(COALESCE(t."registrationNumber", ''))) ${dir}`;
            break;
          default:
            orderClause = `t."createdAt" DESC`;
        }

        const needsGroupBy = sortBy === "territoire";
        const groupByClause = needsGroupBy ? `GROUP BY t."id"` : "";

        const offset = (page - 1) * pageSize;
        const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT COUNT(*)::bigint as count FROM "Team" t WHERE ${whereClause}`,
          ...whereParams,
        );
        const total = Number(countResult[0].count);

        const paginationClause = `LIMIT ${pageSize} OFFSET ${offset}`;

        const ids = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT t."id" FROM "Team" t ${joinClause} WHERE ${whereClause} ${groupByClause} ORDER BY ${orderClause} ${paginationClause}`,
          ...whereParams,
        );

        return { ids: ids.map((r) => r.id), total };
      }

      const teamInclude = {
        managers: true,
        organization: {
          include: {
            specificFields: true,
            tags: true,
          },
        },
        areas: true,
        _count: { select: { users: true } },
      };

      // Helper: fetches teams by IDs and preserves order
      async function fetchTeamsByIds(ids: string[]) {
        if (ids.length === 0) return [];
        const items = await prisma.team.findMany({
          where: { id: { in: ids }, deletedAt: null },
          include: teamInclude,
        });
        const idOrder = new Map(ids.map((id, index) => [id, index]));
        return items.sort(
          (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
        );
      }

      // for Admin, return paginated teams
      if (ctx.user.role === USER_ROLES.ADMIN) {
        // Search with unaccent() for accent-insensitive matching
        if (search) {
          if (sortBy || hasFilters) {
            // Tri + recherche en une seule requête SQL paginée
            const conditions = buildTeamSearchConditions(search);
            if (!conditions) {
              return {
                items: [],
                total: 0,
                page,
                pageSize,
                totalPages: 0,
              };
            }
            const { ids, total } = await getSortedTeamIds(
              `t."deletedAt" IS NULL AND ${conditions.whereSQL}`,
              conditions.params,
            );
            return {
              items: await fetchTeamsByIds(ids),
              total,
              page,
              pageSize,
              totalPages: Math.ceil(total / pageSize),
            };
          }

          const { ids, total } = await searchTeamsWithUnaccent(
            search,
            page,
            pageSize,
          );

          return {
            items: await fetchTeamsByIds(ids),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          };
        }

        const { ids, total } = await getSortedTeamIds(
          `t."deletedAt" IS NULL`,
          [],
        );

        return {
          items: await fetchTeamsByIds(ids),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      }

      // For supervisors, return teams matching their areas AND organizations
      if (ctx.user.role === USER_ROLES.SUPERVISOR) {
        const supervisor = await prisma.supervisor.findUnique({
          where: { userId: ctx.userId },
          include: { areas: true, organizations: true },
        });

        if (!supervisor) {
          return {
            items: [],
            total: 0,
            page: 1,
            pageSize,
            totalPages: 0,
          };
        }

        const areaIds = supervisor.areas.map((a) => a.id);
        const orgIds = supervisor.organizations.map((o) => o.id);

        // Build scope SQL for raw queries
        const orgPlaceholders = orgIds.map((_, i) => `$${i + 1}`).join(", ");
        const areaPlaceholders = areaIds
          .map((_, i) => `$${orgIds.length + i + 1}`)
          .join(", ");
        const scopeSQL = `t."deletedAt" IS NULL AND t."organizationId" IN (${orgPlaceholders}) AND EXISTS (SELECT 1 FROM "_AreaToTeam" at2 WHERE at2."B" = t."id" AND at2."A" IN (${areaPlaceholders}))`;
        const scopeParams = [...orgIds, ...areaIds];

        if (search) {
          if (sortBy || hasFilters) {
            // Tri + recherche en une seule requête SQL paginée
            const conditions = buildTeamSearchConditions(search, {
              areaIds,
              organizationIds: orgIds,
            });
            if (!conditions) {
              return {
                items: [],
                total: 0,
                page,
                pageSize,
                totalPages: 0,
              };
            }
            const { ids, total } = await getSortedTeamIds(
              `t."deletedAt" IS NULL AND ${conditions.whereSQL}`,
              conditions.params,
            );
            return {
              items: await fetchTeamsByIds(ids),
              total,
              page,
              pageSize,
              totalPages: Math.ceil(total / pageSize),
            };
          }

          const { ids, total } = await searchTeamsWithUnaccent(
            search,
            page,
            pageSize,
            { areaIds, organizationIds: orgIds },
          );

          return {
            items: await fetchTeamsByIds(ids),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          };
        }

        const { ids, total } = await getSortedTeamIds(scopeSQL, scopeParams);

        return {
          items: await fetchTeamsByIds(ids),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      }

      // For non-admin users, return their teams with pagination
      const userScopeSQL = `t."deletedAt" IS NULL AND EXISTS (SELECT 1 FROM "_TeamToUser" tu WHERE tu."A" = t."id" AND tu."B" = $1)`;
      const { ids: userTeamIds, total: userTotal } = await getSortedTeamIds(
        userScopeSQL,
        [ctx.userId],
      );

      return {
        items: await fetchTeamsByIds(userTeamIds),
        total: userTotal,
        page,
        pageSize,
        totalPages: Math.ceil(userTotal / pageSize),
      };
    }),
  getTeamsByUserId: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      const isAdminOrSelf =
        ctx.user.role === USER_ROLES.ADMIN || ctx.userId === input;
      if (!isAdminOrSelf) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vous n'avez pas accès aux équipes de cet utilisateur.",
        });
      }
      return prisma.team.findMany({
        where: { users: { some: { id: input } }, deletedAt: null },
      });
    }),
  getColleaguesByTeamId: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      await checkTeamAccess(ctx, input);
      // ctx.userId is guaranteed by protectedProcedure
      // not return the user itself
      const users = await prisma.user.findMany({
        where: {
          teams: { some: { id: input } },
          id: { not: ctx.userId },
          isInactive: null,
          deletedAt: null,
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      return users;
    }),
  updateTeam: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        email: z
          .string()
          .email()
          .transform(normalizeEmail)
          .optional()
          .nullable(),
        description: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await checkTeamModifyAccess(ctx, input.id);
      return prisma.team.update({
        where: { id: input.id },
        data: {
          name: input.name,
          email: input.email,
          description: input.description,
        },
      });
    }),

  updateTeamAcceptTypes: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        acceptTypes: z.array(z.nativeEnum(TeamType)),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await checkTeamModifyAccess(ctx, input.id);
      return prisma.team.update({
        where: { id: input.id },
        data: {
          acceptTypes: input.acceptTypes,
        },
      });
    }),

  addUserToTeam: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        users: z.array(
          z.object({
            email: z.string().email().transform(normalizeEmail),
            isManager: z.boolean(),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await checkTeamModifyAccess(ctx, input.teamId);
      const result = await prisma.$transaction(async (tx) => {
        // If user exist link it to the team and the manager if isManager is true
        const existingUsers = await tx.user.findMany({
          where: {
            email: { in: input.users.map((user) => user.email) },
          },
        });

        const updatedUsers = await Promise.all(
          existingUsers.map(async (user) => {
            const userInput = input.users.find((u) => u.email === user.email);
            return tx.user.update({
              where: { id: user.id },
              data: {
                teams: { connect: { id: input.teamId } },
                managedTeams: userInput?.isManager
                  ? { connect: { id: input.teamId } }
                  : undefined,
              },
            });
          }),
        );

        // If user does not exist, create a pending user and link it to the team and the manager if isManager is true
        const usersToCreate = input.users.filter(
          (user) => !existingUsers.some((u) => u.email === user.email),
        );

        const createdPendingUsers = await Promise.all(
          usersToCreate.map(async (user) => {
            const verificationToken = await createVerificationToken({
              email: user.email,
              firstName: null,
              lastName: null,
            });
            // Need to upsert because pending user can be already a pending user ... (removed from team)
            return tx.pendingUser.upsert({
              where: { email: user.email },
              create: {
                verificationToken,
                // 7 days validity for invitation link
                tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                email: user.email,
                teams: { connect: { id: input.teamId } },
                managedTeams: user.isManager
                  ? { connect: { id: input.teamId } }
                  : undefined,
              },
              update: {
                teams: { connect: { id: input.teamId } },
                managedTeams: user.isManager
                  ? { connect: { id: input.teamId } }
                  : undefined,
              },
            });
          }),
        );

        return {
          updatedUsers,
          createdPendingUsers,
        };
      });

      // Send emails AFTER transaction completes (side effects should not be in transactions)
      await Promise.all(
        result.createdPendingUsers.map(async (pendingUser) => {
          const linkUrl = `${process.env.NEXT_PUBLIC_APP_URL}${ROUTE.FINISH_REGISTRATION}?token=${pendingUser.verificationToken}`;
          await sendTemplatedEmail("CONFIRM_ACCOUNT", {
            to: [{ email: pendingUser.email, name: pendingUser.email }],
            params: { linkUrl },
          });
        }),
      );

      return result;
    }),
  previewRemoveFromTeam: protectedProcedure
    .input(z.object({ teamId: z.string(), userId: z.string() }))
    .query(async ({ input, ctx }) => {
      await checkTeamModifyAccess(ctx, input.teamId);

      const [user, team] = await Promise.all([
        prisma.user.findUnique({
          where: { id: input.userId },
          select: { firstName: true, lastName: true },
        }),
        prisma.team.findUnique({
          where: { id: input.teamId },
          select: { name: true },
        }),
      ]);

      if (!user || !team) return null;

      const removedUserName =
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();

      const { scenarios } = await processTeamRemovalReports(
        prisma,
        input.userId,
        input.teamId,
        removedUserName,
        ctx.userId,
      );

      // Fetch report details for enrichment
      const reportIds = scenarios.map((s) => s.reportId);
      const reports = await prisma.report.findMany({
        where: { id: { in: reportIds } },
        select: { id: true, subject: true, firstName: true, lastName: true },
      });
      const reportMap = new Map(reports.map((r) => [r.id, r]));

      // Fetch new author names for AUTHOR_TRANSFER scenarios
      const newAuthorIds = scenarios
        .filter((s) => s.type === "AUTHOR_TRANSFER")
        .map((s) => (s as { newAuthorId: string }).newAuthorId);

      const newAuthors = await prisma.user.findMany({
        where: { id: { in: newAuthorIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      const authorMap = new Map(newAuthors.map((u) => [u.id, u]));

      // Build enriched scenarios
      const enrichedScenarios = scenarios.map((scenario) => {
        const report = reportMap.get(scenario.reportId);
        const base = {
          type: scenario.type,
          reportId: scenario.reportId,
          reportSubject: report?.subject ?? "Inconnu",
          reportApplicant: report
            ? `${report.firstName} ${report.lastName}`
            : "Inconnu",
        };

        if (scenario.type === "AUTHOR_TRANSFER") {
          const s = scenario as {
            newAuthorId: string;
            newCoAuthorIds: string[];
          };
          const newAuthor = authorMap.get(s.newAuthorId);
          return {
            ...base,
            newAuthor: newAuthor
              ? `${newAuthor.firstName} ${newAuthor.lastName}`
              : "Inconnu",
            newAuthorEmail: newAuthor?.email ?? "",
          };
        }

        return base;
      });

      return {
        scenarios: enrichedScenarios,
        teamName: team.name,
      };
    }),

  previewDeleteTeam: protectedProcedure
    .input(z.string())
    .query(async ({ input: teamId, ctx }) => {
      const isAdmin = ctx.user.role === USER_ROLES.ADMIN;
      const isSupervisor = ctx.user.role === USER_ROLES.SUPERVISOR;

      if (!isAdmin && !isSupervisor) {
        throw new Error(
          "Seuls les administrateurs et superviseurs peuvent prévisualiser la suppression",
        );
      }

      // Même périmètre que deleteTeam : un superviseur ne prévisualise pas
      // la suppression d'une équipe qu'il n'aurait pas le droit de supprimer.
      if (isSupervisor) {
        await checkSupervisorScopeForTeam(ctx, teamId);
      }

      const scenarios = await previewTeamDeletionReports(prisma, teamId);

      // Enrich scenarios with report details
      const reportIds = scenarios.map((s) => s.reportId);
      const reports = await prisma.report.findMany({
        where: { id: { in: reportIds } },
        select: { id: true, subject: true, firstName: true, lastName: true },
      });
      // Superviseurs et admins voient ces champs masqués partout ailleurs :
      // la prévisualisation suit la même politique.
      const maskedReports = maskReportsForRole(
        reports,
        getMaskingRole(ctx.user.role, ctx.impersonatedBy),
      );
      const reportMap = new Map(maskedReports.map((r) => [r.id, r]));

      const enrichedScenarios = scenarios.map((scenario) => {
        const report = reportMap.get(scenario.reportId);
        return {
          type: scenario.type,
          reportId: scenario.reportId,
          reportSubject: report?.subject ?? "Inconnu",
          reportApplicant: report
            ? `${report.firstName} ${report.lastName}`
            : "Inconnu",
        };
      });

      return { scenarios: enrichedScenarios };
    }),

  removeUserFromTeam: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await checkTeamModifyAccess(ctx, input.teamId);

      // Get user name for messages
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { firstName: true, lastName: true },
      });

      const removedUserName =
        `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() ||
        "Utilisateur";

      // Process reports before removing user
      const { operations } = await processTeamRemovalReports(
        prisma,
        input.userId,
        input.teamId,
        removedUserName,
        ctx.userId,
      );

      // Execute all operations in a single transaction
      await prisma.$transaction([
        ...operations,
        prisma.team.update({
          where: { id: input.teamId },
          data: {
            users: { disconnect: { id: input.userId } },
            managers: { disconnect: { id: input.userId } },
            pendingUsers: { disconnect: { id: input.userId } },
            pendingManagers: { disconnect: { id: input.userId } },
          },
        }),
      ]);

      return { success: true };
    }),
  getManagerInheritedTeamType: protectedProcedure.query(async ({ ctx }) => {
    const managedTeams = await prisma.team.findMany({
      where: { managers: { some: { id: ctx.userId } }, deletedAt: null },
      select: { type: true },
      orderBy: { createdAt: "asc" },
    });

    if (managedTeams.length === 0) return null;

    const distinctTypes = new Set(managedTeams.map((t) => t.type));

    if (distinctTypes.size > 1) {
      return { type: null, hasDifferentTypes: true };
    }

    // Single type: inherit only if it's not OPERATOR (OPERATOR is determined by org role)
    const singleType = managedTeams[0].type;
    if (singleType === TeamType.OPERATOR) return null;

    return { type: singleType, hasDifferentTypes: false };
  }),

  createTeam: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        organizationId: z.string(),
        areaIds: z.array(z.string()),
        email: z
          .string()
          .email()
          .transform(normalizeEmail)
          .optional()
          .nullable(),
        description: z.string().optional().nullable(),
        registrationNumber: z.string().optional().nullable(),
        type: z.nativeEnum(TeamType).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // ctx.userId and ctx.user are guaranteed by protectedProcedure
      const isAdmin = ctx.user.role === USER_ROLES.ADMIN;
      const isSupervisor = ctx.user.role === USER_ROLES.SUPERVISOR;
      const isManager = await userIsManager(ctx.userId);
      if (!isAdmin && !isSupervisor && !isManager) {
        throw new Error(
          "Seuls les administrateurs, superviseurs et responsables peuvent créer des équipes",
        );
      }

      // Validate supervisor scope
      if (isSupervisor) {
        const supervisor = await prisma.supervisor.findUnique({
          where: { userId: ctx.userId },
          include: { areas: true, organizations: true },
        });
        if (!supervisor) {
          throw new Error("Périmètre superviseur introuvable");
        }
        const allowedOrgIds = new Set(
          supervisor.organizations.map((o) => o.id),
        );
        if (!allowedOrgIds.has(input.organizationId)) {
          throw new Error("Organisation hors de votre périmètre superviseur");
        }
        const allowedAreaIds = new Set(supervisor.areas.map((a) => a.id));
        const outOfScope = input.areaIds.filter(
          (id) => !allowedAreaIds.has(id),
        );
        if (outOfScope.length > 0) {
          throw new Error(
            "Un ou plusieurs territoires sont hors de votre périmètre superviseur",
          );
        }
      }

      // Un manager ne crée que dans une organisation où il gère déjà une équipe.
      if (!isAdmin && !isSupervisor) {
        await checkManagerCreatesInOwnOrganization(ctx, input.organizationId);
      }

      if (input.registrationNumber) {
        const existingTeam = await prisma.team.findFirst({
          where: {
            registrationNumber: input.registrationNumber,
            deletedAt: null,
          },
        });
        if (existingTeam) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule.",
          });
        }
      }

      // Determine team type: inherit from organization by default
      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: input.organizationId },
        select: { type: true, role: true },
      });

      let teamType: TeamType = organization.type;

      if ((isAdmin || isSupervisor) && input.type) {
        // Admin and supervisor can override type
        teamType = input.type;
      } else if (!isAdmin && !isSupervisor) {
        const managedTeams = await prisma.team.findMany({
          where: { managers: { some: { id: ctx.userId } }, deletedAt: null },
          select: { type: true },
          orderBy: { createdAt: "asc" },
        });

        const distinctTypes = new Set(managedTeams.map((t) => t.type));

        if (distinctTypes.size > 1 && input.type) {
          // Manager with different team types: use chosen type
          teamType = input.type;
        } else if (
          managedTeams.length >= 1 &&
          managedTeams[0].type !== TeamType.OPERATOR
        ) {
          // All same non-OPERATOR type: inherit
          teamType = managedTeams[0].type;
        }
      }

      // Check for existing team with same name in organization
      const existingTeamByName = await prisma.team.findFirst({
        where: {
          organizationId: input.organizationId,
          name: input.name,
          deletedAt: null,
        },
      });
      if (existingTeamByName) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Une équipe avec ce nom existe déjà dans cette organisation",
        });
      }

      // create team - only connect user as manager/user if they are not an admin or supervisor
      try {
        return await prisma.team.create({
          data: {
            name: input.name,
            email: input.email,
            description: input.description,
            registrationNumber: input.registrationNumber,
            // Le rôle (OPERATOR/HELPER) décide de la présence dans les listes
            // d'adressage des signalements : il se dérive de l'organisation,
            // jamais de l'entrée client.
            role: organization.role,
            type: teamType,
            organization: { connect: { id: input.organizationId } },
            areas: { connect: input.areaIds.map((id) => ({ id })) },
            ...(isAdmin || isSupervisor
              ? {}
              : {
                  managers: { connect: { id: ctx.userId } },
                  users: { connect: { id: ctx.userId } },
                }),
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const target = (error.meta?.target as string[]) ?? [];
          if (target.includes("registrationNumber")) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule.",
            });
          }
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Une équipe avec ce nom existe déjà dans cette organisation",
          });
        }
        throw error;
      }
    }),

  updateTeamAdmin: adminProcedure
    .input(
      z.object({
        id: z.string(),
        areaIds: z.array(z.string()),
        organizationId: z.string().optional(),
        adminComment: z.string().optional().nullable(),
        type: z.nativeEnum(TeamType).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // Admin role is guaranteed by adminProcedure
      let newRole: OrganizationRole | undefined;
      let teamType: TeamType | undefined = input.type;

      // need to update team role and type if organization is changed
      if (input.organizationId) {
        const organization = await prisma.organization.findUnique({
          where: { id: input.organizationId },
        });
        if (organization) {
          newRole = organization.role;
          // Inherit type from organization (admin can still override via input.type)
          if (!input.type) {
            teamType = organization.type;
          }
        }
      }

      return prisma.team.update({
        where: { id: input.id },
        data: {
          areas: { set: input.areaIds.map((id) => ({ id })) },
          ...(input.organizationId && {
            organization: { connect: { id: input.organizationId } },
          }),
          ...(newRole && { role: newRole }),
          ...(input.adminComment && { adminComment: input.adminComment }),
          ...(teamType && { type: teamType }),
        },
      });
    }),

  updateTeamAreas: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        areaIds: z
          .array(z.string())
          .min(1, "Au moins un territoire est requis"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === USER_ROLES.ADMIN;
      const isSupervisor = ctx.user.role === USER_ROLES.SUPERVISOR;

      if (!isAdmin && !isSupervisor) {
        throw new Error(
          "Seuls les administrateurs et superviseurs peuvent modifier les territoires",
        );
      }

      if (isSupervisor) {
        const supervisor = await prisma.supervisor.findUnique({
          where: { userId: ctx.userId },
          include: { areas: true, organizations: true },
        });
        if (!supervisor) {
          throw new Error("Périmètre superviseur introuvable");
        }

        // Validate team is in supervisor's scope
        const team = await prisma.team.findUnique({
          where: { id: input.id },
          include: { areas: true },
        });
        if (!team) {
          throw new Error("Équipe introuvable");
        }

        const allowedOrgIds = new Set(
          supervisor.organizations.map((o) => o.id),
        );
        if (!allowedOrgIds.has(team.organizationId)) {
          throw new Error("Équipe hors de votre périmètre superviseur");
        }

        const allowedAreaIds = new Set(supervisor.areas.map((a) => a.id));
        const teamAreaIds = team.areas.map((a) => a.id);
        const hasAreaInScope = teamAreaIds.some((id) => allowedAreaIds.has(id));
        if (!hasAreaInScope) {
          throw new Error("Équipe hors de votre périmètre superviseur");
        }

        // Validate all new areaIds are in supervisor's scope
        const outOfScope = input.areaIds.filter(
          (id) => !allowedAreaIds.has(id),
        );
        if (outOfScope.length > 0) {
          throw new Error(
            "Un ou plusieurs territoires sont hors de votre périmètre superviseur",
          );
        }
      }

      return prisma.team.update({
        where: { id: input.id },
        data: {
          areas: { set: input.areaIds.map((id) => ({ id })) },
        },
      });
    }),

  deleteTeam: protectedProcedure
    .input(z.string())
    .mutation(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === USER_ROLES.ADMIN;
      const isSupervisor = ctx.user.role === USER_ROLES.SUPERVISOR;

      if (!isAdmin && !isSupervisor) {
        throw new Error(
          "Seuls les administrateurs et superviseurs peuvent supprimer des équipes",
        );
      }

      // Load team with members
      const team = await prisma.team.findUnique({
        where: { id: input },
        include: {
          areas: true,
          users: { select: { id: true, firstName: true, lastName: true } },
          managers: { select: { id: true } },
          pendingUsers: { select: { id: true } },
          pendingManagers: { select: { id: true } },
        },
      });

      if (!team) {
        throw new Error("Équipe introuvable");
      }

      if (team.deletedAt) {
        throw new Error("Cette équipe est déjà supprimée");
      }

      if (isSupervisor) {
        const supervisor = await prisma.supervisor.findUnique({
          where: { userId: ctx.userId },
          include: { areas: true, organizations: true },
        });
        if (!supervisor) {
          throw new Error("Périmètre superviseur introuvable");
        }

        const allowedOrgIds = new Set(
          supervisor.organizations.map((o) => o.id),
        );
        if (!allowedOrgIds.has(team.organizationId)) {
          throw new Error("Équipe hors de votre périmètre superviseur");
        }

        const allowedAreaIds = new Set(supervisor.areas.map((a) => a.id));
        const teamAreaIds = team.areas.map((a) => a.id);
        const hasAreaInScope = teamAreaIds.some((id) => allowedAreaIds.has(id));
        if (!hasAreaInScope) {
          throw new Error("Équipe hors de votre périmètre superviseur");
        }
      }

      // Process all reports affected by this team deletion
      const teamName = team.name || "Équipe supprimée";
      const { operations: allOperations } = await processTeamDeletionReports(
        prisma,
        input,
        teamName,
        ctx.userId,
      );

      // Soft delete: disconnect all members and set deletedAt
      await prisma.$transaction([
        ...allOperations,
        prisma.team.update({
          where: { id: input },
          data: {
            users: { set: [] },
            managers: { set: [] },
            pendingUsers: { set: [] },
            pendingManagers: { set: [] },
            deletedAt: new Date(),
          },
        }),
      ]);

      return { success: true };
    }),

  addManager: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        memberId: z.string(),
        isPending: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await checkTeamModifyAccess(ctx, input.teamId);
      if (input.isPending) {
        return prisma.team.update({
          where: { id: input.teamId },
          data: {
            pendingManagers: { connect: { id: input.memberId } },
          },
        });
      }
      return prisma.team.update({
        where: { id: input.teamId },
        data: {
          managers: { connect: { id: input.memberId } },
        },
      });
    }),

  removeManager: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        memberId: z.string(),
        isPending: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await checkTeamModifyAccess(ctx, input.teamId);
      // Check if this is the last manager
      const team = await prisma.team.findUnique({
        where: { id: input.teamId },
        select: {
          managers: { select: { id: true } },
          pendingManagers: { select: { id: true } },
        },
      });

      const totalManagers =
        (team?.managers?.length ?? 0) + (team?.pendingManagers?.length ?? 0);

      if (totalManagers <= 1) {
        throw new Error(
          "Impossible de retirer le dernier responsable de l'équipe",
        );
      }

      if (input.isPending) {
        return prisma.team.update({
          where: { id: input.teamId },
          data: {
            pendingManagers: { disconnect: { id: input.memberId } },
          },
        });
      }
      return prisma.team.update({
        where: { id: input.teamId },
        data: {
          managers: { disconnect: { id: input.memberId } },
        },
      });
    }),
});
