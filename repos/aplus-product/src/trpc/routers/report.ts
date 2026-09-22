import { protectedProcedure, createTRPCRouter } from "../init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reportFormSchemaWithFileObjects } from "@/app/component/request-form/request-form.schema";
import { isAdmin, isSupervisor } from "@/utils/auth";
import {
  maskReportsForRole,
  maskReportForRole,
  getMaskingRole,
} from "@/utils/mask-sensitive-data";
import { searchWithUnaccent } from "@/utils/search";
import {
  ReportStatus,
  NotificationFrequency,
  NotificationType,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { buildReportUrl } from "@/utils/report-url";
import { clientReportStatusSchema } from "@/utils/report-status-input";
import {
  checkCoAuthorsInApplicantTeam,
  checkReportAccess,
  checkTeamAccess,
  checkTeamsInvitableForReport,
} from "../middleware/authorization";

async function fetchViewerIdSet(reportId: string): Promise<Set<string>> {
  const views = await prisma.notificationView.findMany({
    where: { type: NotificationType.REPORT, targetId: reportId },
    select: { userId: true },
  });
  return new Set(views.map((v) => v.userId));
}

// Select optimisé pour le tableau : on ne charge que la dernière réponse pour "dernier message"
// et les authorId distincts pour le filtre "mes réponses"
const reportTableSelect = {
  id: true,
  authorId: true,
  firstName: true,
  lastName: true,
  subject: true,
  status: true,
  overdueAt: true,
  createdAt: true,
  updatedAt: true,
  area: {
    select: { id: true, name: true },
  },
  author: {
    select: { id: true, firstName: true, lastName: true },
  },
  applicantTeam: {
    select: { id: true, name: true, deletedAt: true },
  },
  requestedTeams: {
    where: { deletedAt: null },
    select: { id: true, name: true },
  },
  // Seulement la dernière réponse pour la date du dernier message
  answers: {
    select: { createdAt: true, authorId: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} satisfies Prisma.ReportSelect;

// Colonnes triables côté serveur
const SORTABLE_COLUMNS = [
  "citizen-subject",
  "author",
  "status",
  "createdAt",
  "lastMessage",
] as const;

// Schema pour la pagination et les filtres côté serveur
const reportTableInputSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(10),
  status: z.array(z.nativeEnum(ReportStatus)).optional(),
  teamIds: z.array(z.string()).optional(),
  search: z.string().optional(),
  myReportsOnly: z.boolean().optional(),
  myAnsweredOnly: z.boolean().optional(),
  overdueOnly: z.boolean().optional(),
  sortBy: z.enum(SORTABLE_COLUMNS).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// Convertit les paramètres de tri en orderBy Prisma
function getOrderBy(
  sortBy?: string,
  sortOrder?: "asc" | "desc",
): Prisma.ReportOrderByWithRelationInput[] | null {
  const order = sortOrder ?? "desc";
  switch (sortBy) {
    case "citizen-subject":
      return [{ lastName: order }, { firstName: order }];
    case "author":
      return [
        { author: { lastName: order } },
        { author: { firstName: order } },
      ];
    case "status":
      return [{ status: order }];
    case "createdAt":
      return [{ createdAt: order }];
    case "lastMessage":
      // Géré séparément car Prisma ne supporte pas ORDER BY sur un agrégat de relation
      return null;
    default:
      return [{ createdAt: "desc" }];
  }
}

// Paramètres structurés pour le tri SQL par dernier message
// Permet de tout faire en une seule requête SQL sans charger d'IDs en mémoire JS
interface LastMessageSortFilters {
  mode: "created" | "requested";
  userId: string;
  isAdminUser: boolean;
  isSupervisorUser: boolean;
  supervisorScope?: { areaIds: string[]; organizationIds: string[] } | null;
  status?: ReportStatus[];
  teamIds?: string[];
  searchReportIds?: string[];
  myReportsOnly?: boolean;
  answeredReportIds?: string[];
  overdueOnly?: boolean;
}

// Construit les conditions SQL et paramètres à partir des filtres structurés
function buildSqlFilters(filters: LastMessageSortFilters): {
  conditions: string[];
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  // Les signalements supprimés (soft delete) ne sont jamais listés
  conditions.push(`r."status" <> '${ReportStatus.DELETED}'`);

  // Condition d'accès selon le rôle
  if (filters.mode === "created") {
    if (filters.isSupervisorUser && filters.supervisorScope) {
      params.push(filters.supervisorScope.areaIds);
      conditions.push(`r."areaId" = ANY($${idx++}::text[])`);
      params.push(filters.supervisorScope.organizationIds);
      conditions.push(
        `r."applicantTeamId" IN (SELECT t."id" FROM "Team" t WHERE t."organizationId" = ANY($${idx++}::text[]))`,
      );
    } else if (filters.isSupervisorUser) {
      // Superviseur sans périmètre → aucun résultat
      conditions.push("FALSE");
    } else if (!filters.isAdminUser) {
      params.push(filters.userId);
      conditions.push(
        `(r."authorId" = $${idx} OR r."id" IN (SELECT "A" FROM "_ReportCoAuthors" WHERE "B" = $${idx}))`,
      );
      idx++;
    }
  } else {
    // mode === "requested"
    if (filters.isSupervisorUser && filters.supervisorScope) {
      params.push(filters.supervisorScope.areaIds);
      conditions.push(`r."areaId" = ANY($${idx++}::text[])`);
      params.push(filters.supervisorScope.organizationIds);
      conditions.push(
        `r."id" IN (
          SELECT rrt."A" FROM "_ReportToRequestedTeams" rrt
          JOIN "Team" t ON t."id" = rrt."B"
          WHERE t."organizationId" = ANY($${idx++}::text[])
        )`,
      );
    } else if (filters.isSupervisorUser) {
      conditions.push("FALSE");
    } else {
      params.push(filters.userId);
      conditions.push(
        `r."id" IN (
          SELECT rrt."A" FROM "_ReportToRequestedTeams" rrt
          JOIN "_TeamToUser" tu ON tu."A" = rrt."B"
          WHERE tu."B" = $${idx++}
        )`,
      );
    }
  }

  // Filtre status
  if (filters.status && filters.status.length > 0) {
    params.push(filters.status);
    conditions.push(`r."status"::text = ANY($${idx++}::text[])`);
  }

  // Filtre équipe
  if (filters.teamIds && filters.teamIds.length > 0) {
    if (filters.mode === "created") {
      params.push(filters.teamIds);
      conditions.push(`r."applicantTeamId" = ANY($${idx++}::text[])`);
    } else {
      params.push(filters.teamIds);
      conditions.push(
        `r."id" IN (SELECT "A" FROM "_ReportToRequestedTeams" WHERE "B" = ANY($${idx++}::text[]))`,
      );
    }
  }

  // Filtre "mes rapports"
  if (filters.myReportsOnly) {
    params.push(filters.userId);
    conditions.push(`r."authorId" = $${idx++}`);
  }

  // Filtre recherche (IDs pré-résolus par searchWithUnaccent)
  if (filters.searchReportIds) {
    params.push(filters.searchReportIds);
    conditions.push(`r."id" = ANY($${idx++}::text[])`);
  }

  // Filtre "mes réponses" (IDs pré-résolus)
  if (filters.answeredReportIds) {
    params.push(filters.answeredReportIds);
    conditions.push(`r."id" = ANY($${idx++}::text[])`);
  }

  // Filtre "en souffrance"
  if (filters.overdueOnly) {
    conditions.push(`r."overdueAt" IS NOT NULL`);
  }

  return { conditions, params };
}

// Tri par dernier message : une seule requête SQL, zéro chargement d'IDs en mémoire JS
// COUNT(*) OVER() donne le total dans la même requête
async function fetchReportIdsSortedByLastMessage(
  filters: LastMessageSortFilters,
  order: "asc" | "desc",
  page: number,
  pageSize: number,
): Promise<{ sortedIds: string[]; totalCount: number }> {
  const { conditions, params } = buildSqlFilters(filters);
  const offset = (page - 1) * pageSize;
  const orderDir = order === "desc" ? "DESC" : "ASC";

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Ajout des paramètres offset et limit
  const offsetIdx = params.length + 1;
  const limitIdx = params.length + 2;
  params.push(offset, pageSize);

  const rows = await prisma.$queryRawUnsafe<
    { id: string; totalCount: bigint }[]
  >(
    `SELECT r."id", COUNT(*) OVER() AS "totalCount"
     FROM "Report" r
     ${whereClause}
     ORDER BY COALESCE(r."lastAnswerAt", r."updatedAt") ${orderDir}
     OFFSET $${offsetIdx} LIMIT $${limitIdx}`,
    ...params,
  );

  return {
    sortedIds: rows.map((r) => r.id),
    totalCount: rows.length > 0 ? Number(rows[0].totalCount) : 0,
  };
}

// Récupère les reportIds où l'utilisateur a répondu (hors réponses métadonnées)
async function getUserAnsweredReportIds(userId: string): Promise<Set<string>> {
  const answers = await prisma.answer.findMany({
    where: { authorId: userId, isMetadataOnly: false },
    select: { reportId: true },
    distinct: ["reportId"],
  });
  return new Set(answers.map((a) => a.reportId));
}

// Version scopée : vérifie uniquement si l'utilisateur a répondu aux rapports de la page courante
async function getUserAnsweredReportIdsForPage(
  userId: string,
  reportIds: string[],
): Promise<Set<string>> {
  if (reportIds.length === 0) return new Set();
  const answers = await prisma.answer.findMany({
    where: {
      authorId: userId,
      reportId: { in: reportIds },
      isMetadataOnly: false,
    },
    select: { reportId: true },
    distinct: ["reportId"],
  });
  return new Set(answers.map((a) => a.reportId));
}

// Statistiques d'un périmètre (créés ou à examiner) pour le bandeau d'aperçu
interface ScopeStats {
  pending: number;
  inTreatment: number;
  treated: number;
  overdue: number;
  // Total de signalements du périmètre (hors DELETED) : permet de savoir si
  // l'utilisateur a réellement ce profil (aidant / opérateur) pour le ciblage du clic.
  total: number;
}

// Compte les signalements d'un périmètre par catégorie d'affichage du bandeau.
// `treated` = COMPLETED uniquement (signalements traités restant à fermer, hors CLOSED) ;
// `overdue` = overdueAt non nul.
async function computeScopeStats(
  where: Prisma.ReportWhereInput,
): Promise<ScopeStats> {
  const baseWhere: Prisma.ReportWhereInput = {
    ...where,
    status: { not: ReportStatus.DELETED },
  };
  const [grouped, overdue] = await Promise.all([
    prisma.report.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.report.count({
      where: { ...baseWhere, overdueAt: { not: null } },
    }),
  ]);
  const countByStatus = (status: ReportStatus) =>
    grouped.find((g) => g.status === status)?._count._all ?? 0;
  return {
    pending: countByStatus(ReportStatus.PENDING_ASSIGNMENT),
    inTreatment: countByStatus(ReportStatus.IN_TREATMENT),
    treated: countByStatus(ReportStatus.COMPLETED),
    overdue,
    total: grouped.reduce((sum, g) => sum + g._count._all, 0),
  };
}

// Helper : récupère le périmètre d'un superviseur (areas + organisations)
async function getSupervisorScope(userId: string) {
  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: {
      areas: { select: { id: true } },
      organizations: { select: { id: true } },
    },
  });
  if (!supervisor) return null;
  return {
    areaIds: supervisor.areas.map((a) => a.id),
    organizationIds: supervisor.organizations.map((o) => o.id),
  };
}

export const reportRouter = createTRPCRouter({
  getMyCreatedReportsTable: protectedProcedure
    .input(reportTableInputSchema.optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const userRole = ctx.user.role;
      const isAdminUser = isAdmin(userRole);
      const isSupervisorUser = isSupervisor(userRole);
      const {
        page = 1,
        pageSize = 10,
        status,
        teamIds,
        search,
        myReportsOnly,
        myAnsweredOnly,
        overdueOnly,
        sortBy,
        sortOrder,
      } = input ?? {};

      const orderBy = getOrderBy(sortBy, sortOrder);

      // Résolution des filtres qui nécessitent des requêtes préalables
      const supervisorScope = isSupervisorUser
        ? await getSupervisorScope(userId)
        : null;

      const searchReportIds =
        search && search.trim().length > 0
          ? await searchWithUnaccent(
              "Report",
              ["subject", "firstName", "lastName"],
              search.trim(),
            )
          : undefined;

      const answeredReportIds = myAnsweredOnly
        ? Array.from(await getUserAnsweredReportIds(userId))
        : undefined;

      // Filtres structurés pour le tri SQL par dernier message
      const sqlFilters: LastMessageSortFilters = {
        mode: "created",
        userId,
        isAdminUser,
        isSupervisorUser,
        supervisorScope,
        status,
        teamIds,
        searchReportIds,
        myReportsOnly,
        answeredReportIds,
        overdueOnly,
      };

      // Construction du where Prisma (utilisé uniquement pour les tris non-lastMessage)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [];

      // Les signalements supprimés (soft delete) ne sont jamais listés
      conditions.push({ status: { not: ReportStatus.DELETED } });

      if (isSupervisorUser) {
        if (
          supervisorScope &&
          supervisorScope.areaIds.length > 0 &&
          supervisorScope.organizationIds.length > 0
        ) {
          conditions.push({
            areaId: { in: supervisorScope.areaIds },
            applicantTeam: {
              organizationId: { in: supervisorScope.organizationIds },
            },
          });
        } else {
          conditions.push({ id: "none" });
        }
      } else if (!isAdminUser) {
        conditions.push({
          OR: [{ authorId: userId }, { coAuthors: { some: { id: userId } } }],
        });
      }

      if (status && status.length > 0) {
        conditions.push({ status: { in: status } });
      }
      if (teamIds && teamIds.length > 0) {
        conditions.push({ applicantTeamId: { in: teamIds } });
      }
      if (myReportsOnly) {
        conditions.push({ authorId: userId });
      }
      if (searchReportIds) {
        conditions.push({ id: { in: searchReportIds } });
      }
      if (answeredReportIds) {
        conditions.push({ id: { in: answeredReportIds } });
      }
      if (overdueOnly) {
        conditions.push({ overdueAt: { not: null } });
      }

      const where = conditions.length > 0 ? { AND: conditions } : undefined;

      type ReportRow = Prisma.ReportGetPayload<{
        select: typeof reportTableSelect;
      }>;
      let reports: ReportRow[];
      let totalCount: number;

      if (orderBy === null) {
        // Tri par dernier message : une seule requête SQL, zéro IDs en mémoire
        const { sortedIds, totalCount: count } =
          await fetchReportIdsSortedByLastMessage(
            sqlFilters,
            sortOrder ?? "desc",
            page,
            pageSize,
          );
        totalCount = count;

        if (sortedIds.length === 0) {
          reports = [];
        } else {
          const unsorted = await prisma.report.findMany({
            where: { id: { in: sortedIds } },
            select: reportTableSelect,
          });

          const idOrder = new Map(sortedIds.map((id, i) => [id, i]));
          reports = unsorted.sort(
            (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
          );
        }
      } else {
        [reports, totalCount] = await Promise.all([
          prisma.report.findMany({
            where,
            select: reportTableSelect,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.report.count({ where }),
        ]);
      }

      // hasUserAnswered : ne charger que pour les 10 rapports de la page courante
      const currentPageReportIds = reports.map((r) => r.id);
      const userAnsweredReportIds = answeredReportIds
        ? new Set(
            currentPageReportIds.filter((id) => answeredReportIds.includes(id)),
          )
        : await getUserAnsweredReportIdsForPage(userId, currentPageReportIds);

      const maskedReports = maskReportsForRole(
        reports,
        getMaskingRole(ctx.user.role, ctx.impersonatedBy),
      );

      return {
        reports: maskedReports.map((report) => ({
          ...report,
          hasUserAnswered: userAnsweredReportIds.has(report.id),
        })),
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      };
    }),

  getMyRequestedReportsTable: protectedProcedure
    .input(reportTableInputSchema.optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const userRole = ctx.user.role;
      const isAdminUser = isAdmin(userRole);
      const isSupervisorUser = isSupervisor(userRole);
      const {
        page = 1,
        pageSize = 10,
        status,
        teamIds,
        search,
        myAnsweredOnly,
        overdueOnly,
        sortBy,
        sortOrder,
      } = input ?? {};

      const orderBy = getOrderBy(sortBy, sortOrder);

      // Résolution des filtres qui nécessitent des requêtes préalables
      const supervisorScope = isSupervisorUser
        ? await getSupervisorScope(userId)
        : null;

      const searchReportIds =
        search && search.trim().length > 0
          ? await searchWithUnaccent(
              "Report",
              ["subject", "firstName", "lastName"],
              search.trim(),
            )
          : undefined;

      const answeredReportIds = myAnsweredOnly
        ? Array.from(await getUserAnsweredReportIds(userId))
        : undefined;

      // Filtres structurés pour le tri SQL par dernier message
      const sqlFilters: LastMessageSortFilters = {
        mode: "requested",
        userId,
        isAdminUser,
        isSupervisorUser,
        supervisorScope,
        status,
        teamIds,
        searchReportIds,
        answeredReportIds,
        overdueOnly,
      };

      // Construction du where Prisma (utilisé uniquement pour les tris non-lastMessage)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [];

      // Les signalements supprimés (soft delete) ne sont jamais listés
      conditions.push({ status: { not: ReportStatus.DELETED } });

      if (isSupervisorUser) {
        if (
          supervisorScope &&
          supervisorScope.areaIds.length > 0 &&
          supervisorScope.organizationIds.length > 0
        ) {
          conditions.push({
            areaId: { in: supervisorScope.areaIds },
            requestedTeams: {
              some: {
                organizationId: { in: supervisorScope.organizationIds },
              },
            },
          });
        } else {
          conditions.push({ id: "none" });
        }
      } else {
        conditions.push({
          requestedTeams: { some: { users: { some: { id: userId } } } },
        });
      }

      if (status && status.length > 0) {
        conditions.push({ status: { in: status } });
      }
      if (teamIds && teamIds.length > 0) {
        conditions.push({
          requestedTeams: { some: { id: { in: teamIds } } },
        });
      }
      if (searchReportIds) {
        conditions.push({ id: { in: searchReportIds } });
      }
      if (answeredReportIds) {
        conditions.push({ id: { in: answeredReportIds } });
      }
      if (overdueOnly) {
        conditions.push({ overdueAt: { not: null } });
      }

      const where = { AND: conditions };

      type ReportRow = Prisma.ReportGetPayload<{
        select: typeof reportTableSelect;
      }>;
      let reports: ReportRow[];
      let totalCount: number;

      if (orderBy === null) {
        // Tri par dernier message : une seule requête SQL, zéro IDs en mémoire
        const { sortedIds, totalCount: count } =
          await fetchReportIdsSortedByLastMessage(
            sqlFilters,
            sortOrder ?? "desc",
            page,
            pageSize,
          );
        totalCount = count;

        if (sortedIds.length === 0) {
          reports = [];
        } else {
          const unsorted = await prisma.report.findMany({
            where: { id: { in: sortedIds } },
            select: reportTableSelect,
          });

          const idOrder = new Map(sortedIds.map((id, i) => [id, i]));
          reports = unsorted.sort(
            (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
          );
        }
      } else {
        [reports, totalCount] = await Promise.all([
          prisma.report.findMany({
            where,
            select: reportTableSelect,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.report.count({ where }),
        ]);
      }

      // hasUserAnswered : ne charger que pour les 10 rapports de la page courante
      const currentPageReportIds = reports.map((r) => r.id);
      const userAnsweredReportIds = answeredReportIds
        ? new Set(
            currentPageReportIds.filter((id) => answeredReportIds.includes(id)),
          )
        : await getUserAnsweredReportIdsForPage(userId, currentPageReportIds);

      const maskedReports = maskReportsForRole(
        reports,
        getMaskingRole(ctx.user.role, ctx.impersonatedBy),
      );

      return {
        reports: maskedReports.map((report) => ({
          ...report,
          hasUserAnswered: userAnsweredReportIds.has(report.id),
        })),
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      };
    }),

  // Compteurs du bandeau d'aperçu « Vos signalements » (relatifs à l'utilisateur).
  // Deux périmètres distincts pour le ciblage du clic : « créés » (profil aidant)
  // et « à examiner » (profil opérateur). null = l'utilisateur n'a pas ce périmètre.
  getMyReportsStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;
    const userRole = ctx.user.role;
    const isAdminUser = isAdmin(userRole);
    const isSupervisorUser = isSupervisor(userRole);

    let createdWhere: Prisma.ReportWhereInput | null;
    let requestedWhere: Prisma.ReportWhereInput | null;

    if (isSupervisorUser) {
      const scope = await getSupervisorScope(userId);
      if (
        scope &&
        scope.areaIds.length > 0 &&
        scope.organizationIds.length > 0
      ) {
        createdWhere = {
          areaId: { in: scope.areaIds },
          applicantTeam: { organizationId: { in: scope.organizationIds } },
        };
        requestedWhere = {
          areaId: { in: scope.areaIds },
          requestedTeams: {
            some: { organizationId: { in: scope.organizationIds } },
          },
        };
      } else {
        createdWhere = null;
        requestedWhere = null;
      }
    } else if (isAdminUser) {
      // Admin : voit tous les signalements créés ; « à examiner » reste scopé aux
      // équipes dont il est membre (cohérent avec les tableaux).
      createdWhere = {};
      requestedWhere = {
        requestedTeams: { some: { users: { some: { id: userId } } } },
      };
    } else {
      createdWhere = {
        OR: [{ authorId: userId }, { coAuthors: { some: { id: userId } } }],
      };
      requestedWhere = {
        requestedTeams: { some: { users: { some: { id: userId } } } },
      };
    }

    const [created, requested] = await Promise.all([
      createdWhere ? computeScopeStats(createdWhere) : Promise.resolve(null),
      requestedWhere
        ? computeScopeStats(requestedWhere)
        : Promise.resolve(null),
    ]);

    return { created, requested };
  }),

  // Statistiques agrégées des équipes de l'utilisateur (onglet « Statistiques de
  // votre/vos équipe(s) »). Calculé en direct sur les tables de base (pas de
  // dépendance à la vue matérialisée analytics, qui n'est rafraîchie que toutes
  // les 30 min) :
  //   - délai moyen de première réponse : 1re réponse d'un membre d'équipe
  //     OPERATOR (hors méta / opérateur-only / non pertinente), création → réponse
  //   - délai moyen de traitement : création → 1re entrée COMPLETED/CLOSED
  // Périmètre = signalements créés par l'équipe (applicantTeam) OU la sollicitant
  // (requestedTeams). Renvoie des délais moyens en jours (fractionnaires), null
  // si aucune donnée.
  getMyTeamStats: protectedProcedure.query(async ({ ctx }) => {
    const teams = await prisma.team.findMany({
      where: { users: { some: { id: ctx.userId } }, deletedAt: null },
      select: { id: true },
    });
    const teamIds = teams.map((t) => t.id);

    if (teamIds.length === 0) {
      return {
        avgAssignmentDays: null,
        avgTreatmentDays: null,
        teamCount: 0,
      };
    }

    const rows = await prisma.$queryRaw<
      { avgAssignment: number | null; avgTreatment: number | null }[]
    >(Prisma.sql`
      WITH team_reports AS (
        SELECT r."id", r."createdAt", r."status"
        FROM "Report" r
        WHERE r."status" <> 'DELETED'
          AND (
            r."applicantTeamId" = ANY(${teamIds}::text[])
            OR r."id" IN (
              SELECT rt."A" FROM "_ReportToRequestedTeams" rt
              WHERE rt."B" = ANY(${teamIds}::text[])
            )
          )
      ),
      -- Prise en charge : premier passage en « En cours de traitement ».
      -- Un seul passage en charge possible, donc l'événement est non ambigu.
      assignment AS (
        SELECT h."reportId", MIN(h."createdAt") AS assigned_at
        FROM "ReportStatusHistory" h
        WHERE h."status" = 'IN_TREATMENT'
          AND h."reportId" IN (SELECT "id" FROM team_reports)
        GROUP BY h."reportId"
      ),
      -- Repli quand aucun passage IN_TREATMENT n'a été historisé (données
      -- anciennes) : première réponse réelle d'un opérateur. Cohérent avec la
      -- définition de la prise en charge dans l'export des signalements.
      first_answer AS (
        SELECT DISTINCT ON (a."reportId")
          a."reportId", a."createdAt" AS answered_at
        FROM "Answer" a
        JOIN "_TeamToUser" tu ON tu."B" = a."authorId"
        JOIN "Team" t ON t."id" = tu."A"
        WHERE a."isMetadataOnly" = false
          AND a."isOperatorOnly" = false
          AND a."isIrrelevant" = false
          AND t."role" = 'OPERATOR'
          AND t."deletedAt" IS NULL
          AND a."reportId" IN (SELECT "id" FROM team_reports)
        ORDER BY a."reportId", a."createdAt" ASC, a."id" ASC
      ),
      -- Traitement : uniquement les signalements actuellement « Traité ». En cas
      -- de réouverture puis nouvelle résolution, on retient la DERNIÈRE date de
      -- passage à COMPLETED (une réouverture signifie que le blocage n'était pas
      -- réellement résolu).
      resolution AS (
        SELECT h."reportId", MAX(h."createdAt") AS resolved_at
        FROM "ReportStatusHistory" h
        WHERE h."status" = 'COMPLETED'
          AND h."reportId" IN (
            SELECT "id" FROM team_reports WHERE "status" = 'COMPLETED'
          )
        GROUP BY h."reportId"
      )
      SELECT
        AVG(EXTRACT(EPOCH FROM (COALESCE(asg.assigned_at, fa.answered_at) - tr."createdAt")) / 86400.0)::float8 AS "avgAssignment",
        AVG(EXTRACT(EPOCH FROM (res.resolved_at - tr."createdAt")) / 86400.0)::float8 AS "avgTreatment"
      FROM team_reports tr
      LEFT JOIN assignment asg ON asg."reportId" = tr."id"
      LEFT JOIN first_answer fa ON fa."reportId" = tr."id"
      LEFT JOIN resolution res ON res."reportId" = tr."id"
    `);

    const row = rows[0];
    return {
      avgAssignmentDays:
        row?.avgAssignment != null ? Number(row.avgAssignment) : null,
      avgTreatmentDays:
        row?.avgTreatment != null ? Number(row.avgTreatment) : null,
      teamCount: teamIds.length,
    };
  }),

  getRecipientsByReportId: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ input, ctx }) => {
      await checkReportAccess(ctx, input.reportId);
      const [report, viewerIds] = await Promise.all([
        prisma.report.findUnique({
          where: { id: input.reportId },
          select: {
            requestedTeams: {
              where: { deletedAt: null },
              select: {
                name: true,
                organization: { select: { name: true, shortName: true } },
                users: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        }),
        fetchViewerIdSet(input.reportId),
      ]);

      return (
        report?.requestedTeams.map((team) => ({
          ...team,
          users: team.users.map((user) => ({
            ...user,
            hasViewed: viewerIds.has(user.id),
          })),
        })) ?? []
      );
    }),

  getReportById: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      await checkReportAccess(ctx, input);

      // Check if user is a helper to filter operator-only answers server-side
      const currentUser = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { teams: { select: { role: true } } },
      });
      const isHelper = currentUser?.teams?.some(
        (team) => team.role === "HELPER",
      );

      const [report, viewerIds] = await Promise.all([
        prisma.report.findUnique({
          where: { id: input },
          include: {
            files: { select: { id: true, name: true } },
            area: true,
            coAuthors: {
              include: {
                teams: {
                  select: { id: true, name: true, deletedAt: true },
                },
              },
            },
            requestedTeams: {
              where: { deletedAt: null },
              include: {
                organization: {
                  include: {
                    specificFields: true,
                  },
                },
              },
            },
            answers: {
              where: isHelper ? { isOperatorOnly: false } : {},
            },
            statusHistory: {
              orderBy: { createdAt: "asc" },
            },
            applicantTeam: {
              include: {
                organization: true,
              },
            },
            author: true,
          },
        }),
        fetchViewerIdSet(input),
      ]);

      if (!report) return null;

      const reportWithViewers = {
        ...report,
        coAuthors: report.coAuthors.map((author) => ({
          ...author,
          hasViewed: viewerIds.has(author.id),
        })),
      };

      return maskReportForRole(
        reportWithViewers,
        getMaskingRole(ctx.user.role, ctx.impersonatedBy),
      );
    }),

  getViewerIdsByReportId: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ input, ctx }) => {
      await checkReportAccess(ctx, input.reportId);
      const viewerIds = await fetchViewerIdSet(input.reportId);
      return Array.from(viewerIds);
    }),

  createReport: protectedProcedure
    .input(reportFormSchemaWithFileObjects)
    .mutation(async ({ input, ctx }) => {
      if (isSupervisor(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Les superviseurs ne peuvent pas créer de signalements.",
        });
      }

      // ctx.userId is guaranteed by protectedProcedure
      const userId = ctx.userId;

      // Retrieve the organizationId from the applicant team
      const applicantTeamId = input.applicantTeam[0].value;
      const applicantTeam = await prisma.team.findUniqueOrThrow({
        where: { id: applicantTeamId },
        select: {
          organizationId: true,
          type: true,
          users: { select: { id: true } },
        },
      });

      // Un co-auteur est un membre de l'équipe autrice. Si l'équipe a changé en
      // cours de formulaire, la sélection peut encore contenir des collègues de
      // l'ancienne équipe : on les écarte.
      const applicantTeamMemberIds = new Set(
        applicantTeam.users.map((member) => member.id),
      );

      // L'auteur signe au nom de l'équipe applicante : il doit en être membre.
      if (!isAdmin(ctx.user.role) && !applicantTeamMemberIds.has(userId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Vous devez être membre de l'équipe à l'origine du signalement.",
        });
      }

      // Les équipes destinataires suivent les mêmes règles que la liste
      // proposée au formulaire, revalidées côté serveur.
      await checkTeamsInvitableForReport(
        {
          areaId: input.area[0].value,
          applicantTeamType: applicantTeam.type,
        },
        input.requestedTeams.map((requestedTeam) => requestedTeam.value),
      );
      const coAuthorIds = input.colleagues.flatMap((colleague) =>
        colleague && applicantTeamMemberIds.has(colleague.value)
          ? [colleague.value]
          : [],
      );

      const data = {
        subject: input.subject,
        description: input.description,
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: input.birthDate,
        citizenPermissionConfirmed: input.citizenPermissionConfirmed,
        caf: input.caf,
        nir: input.nir,
        nif: input.nif,
        phone: input.phone,
        maritalName: input.maritalName,
        organization: {
          connect: { id: applicantTeam.organizationId },
        },
        requestedTeams: {
          connect: input.requestedTeams.map((requestedTeam) => ({
            id: requestedTeam.value,
          })),
        },
        author: {
          connect: { id: userId },
        },
        coAuthors: {
          connect: coAuthorIds.map((id) => ({ id })),
        },
        area: {
          connect: { id: input.area[0].value },
        },
        applicantTeam: {
          connect: {
            id: applicantTeamId,
          },
        },
        files: {
          createMany: {
            data: input.files.map((f) => ({
              id: f.id,
              name: f.name,
              type: f.type,
              size: f.size,
              lastModified: f.lastModified,
            })),
          },
        },
      };

      const report = await prisma.$transaction(async (tx) => {
        const createdReport = await tx.report.create({
          data,
        });

        await tx.reportStatusHistory.create({
          data: {
            reportId: createdReport.id,
            status: ReportStatus.PENDING_ASSIGNMENT,
            authorId: userId,
          },
        });

        return createdReport;
      });

      // Send email notification to all users in requested teams
      try {
        // Get author info for sender
        const author = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true },
        });

        // Get all users from requested teams
        const requestedTeamIds = input.requestedTeams.map((t) => t.value);
        const teamsWithUsers = await prisma.team.findMany({
          where: { id: { in: requestedTeamIds }, deletedAt: null },
          select: {
            users: {
              where: { isInactive: null },
              select: {
                email: true,
                firstName: true,
                lastName: true,
                notificationFrequency: true,
              },
            },
          },
        });

        // Flatten, deduplicate recipients, and filter by notification preferences
        // Only send immediate notifications to users with EACH_SOLICITATION frequency
        const allRecipients = teamsWithUsers.flatMap((team) => team.users);
        const uniqueRecipients = Array.from(
          new Map(allRecipients.map((u) => [u.email, u])).values(),
        ).filter(
          (recipient) =>
            recipient.notificationFrequency ===
            NotificationFrequency.EACH_SOLICITATION,
        );
        if (author && uniqueRecipients.length > 0) {
          const authorName = `${author.firstName} ${author.lastName}`.trim();
          const reportUrl = buildReportUrl(report.id);
          // Send email to each recipient
          // Note: We use default sender (verified in Brevo) and set replyTo to author
          await Promise.all(
            uniqueRecipients.map((recipient) =>
              sendTemplatedEmail("REPORT_CREATED", {
                to: [
                  {
                    email: recipient.email,
                    name: `${recipient.firstName} ${recipient.lastName}`.trim(),
                  },
                ],
                params: {
                  userFirstName: recipient.firstName ?? "",
                  reportSubject: input.subject,
                  reportUrl,
                  authorName,
                },
                replyTo: { email: author.email, name: authorName },
              }),
            ),
          );
        }
      } catch (error) {
        // Log error but don't fail the report creation
        console.error("Failed to send report creation emails:", error);
      }

      return {
        success: true,
      };
    }),

  updateReportStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        // Optionnel : à la réouverture d'un signalement fermé, le client
        // n'envoie pas de statut, c'est le serveur qui restaure le statut réel
        // d'avant la fermeture depuis l'historique.
        status: clientReportStatusSchema.optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await checkReportAccess(ctx, input.id);
      // Bloquer la réouverture si l'équipe applicante a été supprimée
      if (input.status !== ReportStatus.CLOSED) {
        const report = await prisma.report.findUnique({
          where: { id: input.id },
          select: { applicantTeam: { select: { deletedAt: true } } },
        });

        if (report?.applicantTeam?.deletedAt) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Impossible de rouvrir ce signalement : l'équipe à l'origine du signalement a été supprimée.",
          });
        }
      }

      const targetStatus = await prisma.$transaction(async (tx) => {
        const current = await tx.report.findUnique({
          where: { id: input.id },
          select: { status: true },
        });

        // À la réouverture d'un signalement fermé, on restaure le statut réel
        // qu'il avait au moment de la fermeture (lu dans l'historique) plutôt
        // que de le deviner à partir des réponses. Un signalement fermé alors
        // qu'il était "en attente de prise en charge" (ex. un simple message
        // ou une invitation a créé une réponse sans le prendre en charge) doit
        // redevenir PENDING_ASSIGNMENT, et non passer à IN_TREATMENT.
        const isReopening =
          current?.status === ReportStatus.CLOSED &&
          input.status !== ReportStatus.CLOSED;

        let resolvedStatus: ReportStatus;
        if (isReopening) {
          const previousStatus = await tx.reportStatusHistory.findFirst({
            where: {
              reportId: input.id,
              status: {
                notIn: [ReportStatus.CLOSED, ReportStatus.DELETED],
              },
            },
            orderBy: { createdAt: "desc" },
            select: { status: true },
          });
          resolvedStatus =
            previousStatus?.status ?? ReportStatus.PENDING_ASSIGNMENT;
        } else {
          if (!input.status) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Le statut est requis pour ce changement.",
            });
          }
          resolvedStatus = input.status;
        }

        if (current?.status === resolvedStatus) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Le signalement est déjà au statut ${resolvedStatus}.`,
          });
        }

        await tx.report.update({
          where: { id: input.id },
          data: { status: resolvedStatus, overdueAt: null },
        });

        await tx.reportStatusHistory.create({
          data: {
            reportId: input.id,
            status: resolvedStatus,
            authorId: ctx.userId, // Use the current user, not the report author
          },
        });

        return resolvedStatus;
      });
      return {
        success: true,
        // Statut réellement appliqué (utile pour l'analytics côté middleware,
        // puisqu'à la réouverture le client n'envoie aucun statut).
        status: targetStatus,
      };
    }),

  addRequestedTeamsToReport: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        teamIds: z.array(z.string()).min(1).max(20),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await checkReportAccess(ctx, input.reportId);
      const report = await prisma.report.findUniqueOrThrow({
        where: { id: input.reportId },
        select: { areaId: true, applicantTeam: { select: { type: true } } },
      });
      await checkTeamsInvitableForReport(
        {
          areaId: report.areaId,
          applicantTeamType: report.applicantTeam.type,
        },
        input.teamIds,
      );
      await prisma.report.update({
        where: { id: input.reportId },
        data: {
          requestedTeams: {
            connect: input.teamIds.map((id) => ({ id })),
          },
        },
      });
      return {
        success: true,
      };
    }),
  addCoAuthorsToReport: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        coAuthorIds: z.array(z.string()).min(1).max(20),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await checkReportAccess(ctx, input.reportId);
      const report = await prisma.report.findUniqueOrThrow({
        where: { id: input.reportId },
        select: { applicantTeamId: true },
      });
      await checkCoAuthorsInApplicantTeam(
        report.applicantTeamId,
        input.coAuthorIds,
      );
      await prisma.report.update({
        where: { id: input.reportId },
        data: {
          coAuthors: { connect: input.coAuthorIds.map((id) => ({ id })) },
        },
      });
      return {
        success: true,
      };
    }),

  getColleagues: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      await checkTeamAccess(ctx, input);
      const userId = ctx.userId;

      return prisma.user.findMany({
        where: {
          teams: {
            some: {
              id: input,
            },
          },
          id: { not: userId },
          isInactive: null,
          deletedAt: null,
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
    }),

  exportCsv: protectedProcedure
    .input(
      z.object({
        areaIds: z.array(z.string()).min(1),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const isAdminUser = isAdmin(ctx.user.role);
      const isSupervisorUser = isSupervisor(ctx.user.role);

      // Vérifier si l'utilisateur est manager d'au moins une équipe
      const managedTeams = await prisma.team.findMany({
        where: {
          managers: { some: { id: ctx.userId } },
          deletedAt: null,
        },
        select: { id: true, areas: { select: { id: true } } },
      });
      const isManagerUser = managedTeams.length > 0;

      if (!isSupervisorUser && !isAdminUser && !isManagerUser) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Seuls les superviseurs, administrateurs et managers peuvent exporter les signalements.",
        });
      }

      let authorizedAreaIds: string[];
      let supervisorOrganizationIds: string[] = [];

      if (isAdminUser) {
        authorizedAreaIds = input.areaIds;
      } else if (isSupervisorUser) {
        const supervisorScope = await getSupervisorScope(ctx.userId);
        if (!supervisorScope) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Aucun périmètre de supervision trouvé.",
          });
        }
        supervisorOrganizationIds = supervisorScope.organizationIds;

        authorizedAreaIds = input.areaIds.filter((id) =>
          supervisorScope.areaIds.includes(id),
        );
        if (authorizedAreaIds.length === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Aucun des territoires sélectionnés ne fait partie de votre périmètre.",
          });
        }
      } else {
        // Manager : scope = territoires des équipes managées
        const managerAreaIds = [
          ...new Set(managedTeams.flatMap((t) => t.areas.map((a) => a.id))),
        ];
        authorizedAreaIds = input.areaIds.filter((id) =>
          managerAreaIds.includes(id),
        );
        if (authorizedAreaIds.length === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Aucun des territoires sélectionnés ne fait partie de vos équipes.",
          });
        }
      }

      const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
      if (input.startDate || input.endDate) {
        dateFilter.createdAt = {};
        if (input.startDate) {
          dateFilter.createdAt.gte = new Date(
            `${input.startDate}T00:00:00.000Z`,
          );
        }
        if (input.endDate) {
          dateFilter.createdAt.lte = new Date(`${input.endDate}T23:59:59.999Z`);
        }
      }

      const EXPORT_LIMIT = 5000;

      const managedTeamIds = managedTeams.map((t) => t.id);

      const where = {
        status: { not: ReportStatus.DELETED },
        ...dateFilter,
        ...(isAdminUser && {
          areaId: { in: authorizedAreaIds },
        }),
        // Même périmètre que checkReportAccess : territoire ET organisation
        // (équipe applicante ou destinataire), sinon un superviseur
        // exporterait tous les signalements du territoire, toutes
        // organisations confondues.
        ...(isSupervisorUser && {
          OR: [
            {
              areaId: { in: authorizedAreaIds },
              OR: [
                {
                  applicantTeam: {
                    organizationId: { in: supervisorOrganizationIds },
                  },
                },
                {
                  requestedTeams: {
                    some: {
                      organizationId: { in: supervisorOrganizationIds },
                    },
                  },
                },
              ],
            },
            { authorId: ctx.userId },
            { coAuthors: { some: { id: ctx.userId } } },
          ],
        }),
        // Pour les managers, inclure tous les signalements visibles :
        // équipes managées (filtrées par territoire) + signalements personnels (sans restriction de territoire)
        ...(!isAdminUser &&
          !isSupervisorUser && {
            OR: [
              {
                areaId: { in: authorizedAreaIds },
                applicantTeamId: { in: managedTeamIds },
              },
              {
                areaId: { in: authorizedAreaIds },
                requestedTeams: { some: { id: { in: managedTeamIds } } },
              },
              { authorId: ctx.userId },
              { coAuthors: { some: { id: ctx.userId } } },
              {
                areaId: { in: authorizedAreaIds },
                requestedTeams: {
                  some: { users: { some: { id: ctx.userId } } },
                },
              },
            ],
          }),
      };

      const [reports, totalCount] = await Promise.all([
        prisma.report.findMany({
          where,
          select: {
            id: true,
            createdAt: true,
            status: true,
            overdueAt: true,
            area: { select: { name: true } },
            author: { select: { firstName: true, lastName: true } },
            coAuthors: { select: { firstName: true, lastName: true } },
            applicantTeam: {
              select: {
                name: true,
                organization: { select: { shortName: true } },
              },
            },
            requestedTeams: {
              where: { deletedAt: null },
              select: {
                name: true,
                _count: { select: { users: true } },
              },
            },
            _count: { select: { answers: true } },
            answers: {
              select: { isIrrelevant: true, createdAt: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
            statusHistory: {
              select: { status: true, createdAt: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: EXPORT_LIMIT,
        }),
        prisma.report.count({ where }),
      ]);

      return { reports, totalCount, limit: EXPORT_LIMIT };
    }),
});
