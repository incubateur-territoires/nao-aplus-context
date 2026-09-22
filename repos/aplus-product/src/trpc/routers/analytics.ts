import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import { ANALYTICS_EVENTS } from "@/types/analytics";
import { formatUserAgent } from "@/utils/format-user-agent";
import type { Prisma } from "@/generated/prisma/client";
import { ReportStatus } from "@/generated/prisma/enums";

// Les events sont insérés par lots (flush) : `createdAt` reflète l'heure
// d'insertion, pas celle de l'action. On trie donc sur `occurredAt` (heure
// réelle), avec repli sur `createdAt` pour les anciens events sans `occurredAt`.
// Partagé par le tableau d'événements et la vue « En bref » pour garantir que
// les lignes apparaissent dans le même ordre que leurs dates affichées.
const EVENTS_LATEST_FIRST: Prisma.AnalyticsEventOrderByWithRelationInput[] = [
  { occurredAt: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
];

const getUserEventsInput = z.object({
  userId: z.string(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  category: z
    .enum([
      "page_view",
      "auth",
      "report",
      "answer",
      "file",
      "user",
      "team",
      "search",
    ])
    .optional(),
  // Les page_view sont très nombreux : exclus par défaut pour ne pas noyer
  // les actions utiles au support.
  includePageViews: z.boolean().default(false),
});

// Nom affichable d'un utilisateur ; les comptes en attente peuvent ne pas
// avoir de prénom/nom, les comptes anonymisés peuvent ne plus exister.
function getDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string | null {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.email;
}

export const analyticsRouter = createTRPCRouter({
  getUserEvents: adminProcedure
    .input(getUserEventsInput)
    .query(async ({ input }) => {
      const where: Prisma.AnalyticsEventWhereInput = {
        OR: [{ userId: input.userId }, { targetUserId: input.userId }],
        ...(input.category ? { eventCategory: input.category } : {}),
        ...(input.includePageViews
          ? {}
          : { eventName: { not: ANALYTICS_EVENTS.PAGE_VIEW } }),
      };

      const [events, total] = await Promise.all([
        prisma.analyticsEvent.findMany({
          where,
          orderBy: EVENTS_LATEST_FIRST,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        prisma.analyticsEvent.count({ where }),
      ]);

      // Pas de @relation entre AnalyticsEvent et User : résolution des noms
      // en une seule requête sur les acteurs et cibles de la page courante.
      const userIds = new Set<string>();
      for (const event of events) {
        if (event.userId) userIds.add(event.userId);
        if (event.targetUserId) userIds.add(event.targetUserId);
      }

      const users =
        userIds.size > 0
          ? await prisma.user.findMany({
              where: { id: { in: [...userIds] } },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            })
          : [];
      const nameById = new Map(
        users.map((user) => [user.id, getDisplayName(user)]),
      );

      const items = events.map((event) => ({
        id: event.id,
        createdAt: event.createdAt,
        occurredAt: event.occurredAt,
        eventName: event.eventName,
        eventCategory: event.eventCategory,
        pagePath: event.pagePath,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata,
        actorId: event.userId,
        actorName: event.userId ? (nameById.get(event.userId) ?? null) : null,
        targetUserId: event.targetUserId,
        targetName: event.targetUserId
          ? (nameById.get(event.targetUserId) ?? null)
          : null,
        // L'utilisateur consulté a subi l'action (l'acteur est quelqu'un
        // d'autre, ou anonyme).
        isTarget: event.userId !== input.userId,
      }));

      return {
        items,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  // Nombre d'événements par catégorie (acteur ou cible), pour alimenter les
  // filtres en chips avec compteurs. Indépendant de la pagination et du
  // filtre courant : inclut toutes les catégories, page_view compris.
  getUserEventCounts: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const grouped = await prisma.analyticsEvent.groupBy({
        by: ["eventCategory"],
        where: {
          OR: [{ userId: input.userId }, { targetUserId: input.userId }],
        },
        _count: { _all: true },
      });

      const byCategory: Record<string, number> = {};
      for (const row of grouped) {
        byCategory[row.eventCategory] = row._count._all;
      }
      return byCategory;
    }),

  // Faits saillants pour l'en-tête de la vue support : dernière connexion,
  // qui a désactivé/réactivé le compte et quand, dernière prise de contrôle,
  // volume de signalements. Chaque fait est null s'il n'a jamais eu lieu.
  getUserActivitySummary: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const asActor = (eventName: string): Prisma.AnalyticsEventWhereInput => ({
        userId: input.userId,
        eventName,
      });
      const asTarget = (
        eventName: string,
      ): Prisma.AnalyticsEventWhereInput => ({
        targetUserId: input.userId,
        eventName,
      });
      const [
        latestSession,
        userRecord,
        signInEvent,
        lastDeactivation,
        lastReactivation,
        reportsCreatedCount,
      ] = await Promise.all([
        // Dernière session better-auth : source de vérité de la connexion
        // (moment où l'utilisateur passe par l'étape de login, distincte de sa
        // dernière activité), et seule à porter le navigateur réellement utilisé.
        // On exclut les sessions d'impersonation (impersonatedBy non nul) :
        // elles portent le userId de la cible mais ont été ouvertes par un
        // admin, ce n'est donc pas une connexion de l'utilisateur.
        prisma.session.findFirst({
          where: { userId: input.userId, impersonatedBy: null },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, userAgent: true },
        }),
        // Date de création du compte : autoritative, pas d'event analytics
        // forcément absent. `lastActivityAt` est maintenu par getCurrentUser
        // (debounce 5 min), hors sessions d'impersonation.
        prisma.user.findUnique({
          where: { id: input.userId },
          select: { createdAt: true, lastActivityAt: true },
        }),
        prisma.analyticsEvent.findFirst({
          where: asActor(ANALYTICS_EVENTS.AUTH_SIGN_IN),
          orderBy: EVENTS_LATEST_FIRST,
          select: { occurredAt: true, createdAt: true },
        }),
        prisma.analyticsEvent.findFirst({
          where: asTarget(ANALYTICS_EVENTS.USER_DEACTIVATED),
          orderBy: EVENTS_LATEST_FIRST,
        }),
        prisma.analyticsEvent.findFirst({
          where: asTarget(ANALYTICS_EVENTS.USER_REACTIVATED),
          orderBy: EVENTS_LATEST_FIRST,
        }),
        // Compté sur la table `Report` (source de vérité) plutôt que sur les
        // events `report_created` : ces derniers manquent pour les signalements
        // créés avant la mise en place du tracking analytics, ou perdus si un
        // flush a échoué, ce qui sous-estimait le total réel.
        // Les signalements supprimés (soft delete) sont exclus, comme partout
        // ailleurs dans l'UI.
        prisma.report.count({
          where: {
            authorId: input.userId,
            status: { not: ReportStatus.DELETED },
          },
        }),
      ]);

      // Résolution des noms des acteurs (celui qui a désactivé / réactivé le
      // compte) en une seule requête.
      const actorIds = [
        lastDeactivation?.userId,
        lastReactivation?.userId,
      ].filter((id): id is string => Boolean(id));

      const actors =
        actorIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: [...new Set(actorIds)] } },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            })
          : [];
      const nameById = new Map(
        actors.map((actor) => [actor.id, getDisplayName(actor)]),
      );

      function toAction(
        event: {
          occurredAt: Date | null;
          createdAt: Date;
          userId: string | null;
        } | null,
      ): { at: Date; actorName: string | null } | null {
        if (!event) return null;
        return {
          at: event.occurredAt ?? event.createdAt,
          actorName: event.userId ? (nameById.get(event.userId) ?? null) : null,
        };
      }

      // Dernière connexion = dernier passage par l'étape de login : session
      // better-auth (moment de création = login), avec repli sur l'event
      // `auth_sign_in`. On n'utilise PAS `lastActivityAt` : ce serait la
      // dernière utilisation de l'app, pas la dernière connexion — deux notions
      // distinctes (une session reste ouverte entre deux connexions).
      const signInEventAt = signInEvent
        ? (signInEvent.occurredAt ?? signInEvent.createdAt)
        : null;
      const lastSignInAt = latestSession?.createdAt ?? signInEventAt ?? null;

      return {
        lastSignInAt,
        // Navigateur connu uniquement via la dernière session.
        lastSignInBrowser: formatUserAgent(latestSession?.userAgent),
        // Dernière utilisation de l'app, notion distincte de la connexion
        // (une session reste ouverte 7 jours entre deux logins).
        lastActivityAt: userRecord?.lastActivityAt ?? null,
        accountCreatedAt: userRecord?.createdAt ?? null,
        reportsCreatedCount,
        lastDeactivation: toAction(lastDeactivation),
        lastReactivation: toAction(lastReactivation),
      };
    }),
});
