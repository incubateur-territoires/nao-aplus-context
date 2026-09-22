import { publicProcedure, protectedProcedure, createTRPCRouter } from "../init";
import { TRPCError } from "@trpc/server";
import prisma from "@/lib/prisma";
import { searchWithUnaccent } from "@/utils/search";
import { FullUser } from "@/types/user";
import { NotificationFrequency } from "@/generated/prisma/enums";
import { USER_ROLES } from "@/constants/user-roles";
import {
  processDeactivationReports,
  TransactionOperation,
} from "@/app/services/user/user-deactivation";
import { processTeamRemovalReports } from "@/app/services/user/user-team-removal";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { revokeUserSessions } from "@/utils/auth-server";
import { headers } from "next/headers";
import { after } from "next/server";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { ROUTE } from "@/app/constant/route";
import {
  checkAdminOnly,
  checkCanDeactivateUser,
  checkCanManagePendingUsers,
} from "../middleware/authorization";
import { findMostActiveTeamMember } from "@/utils/report";
import {
  createVerificationToken,
  hashResetToken,
} from "@/utils/verification-token";
import { isDebugModeEnabled } from "@/utils/debug-mode";
import { normalizeEmail } from "@/utils/normalize";
import * as Sentry from "@sentry/nextjs";

export const userRouter = createTRPCRouter({
  // publicProcedure because it returns null for anonymous users (used to check current user status)
  getCurrentUser: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      return null;
    }

    // Strip staff-only notes (internalSupportComment / adminComment) from the
    // payload returned to the user themselves. These fields exist for support
    // staff and must not be exposed to the user they're written about.
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      omit: { internalSupportComment: true },
      include: {
        teams: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            deletedAt: true,
            role: true,
            organization: { select: { id: true, name: true } },
            areas: { select: { id: true, name: true, timezone: true } },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Update lastActivityAt if > 5 minutes since last update (debouncing).
    // Jamais pendant une impersonation : la session porte le userId de la
    // cible, donc sans ce garde-fou un admin en « Aperçu de l'utilisateur »
    // marquerait la cible comme active à sa place — et pire, remettrait à zéro
    // son cycle d'inactivité (inactivityWarningsSentAt), empêchant un compte
    // réellement inactif d'être averti puis désactivé par le cron.
    const FIVE_MINUTES = 5 * 60 * 1000;
    const shouldUpdateActivity =
      !ctx.impersonatedBy &&
      (!user.lastActivityAt ||
        Date.now() - user.lastActivityAt.getTime() > FIVE_MINUTES);

    if (shouldUpdateActivity) {
      // Fire and forget - don't block the response. Resetting
      // inactivityWarningsSentAt is intentional: any user activity restarts
      // the inactivity cycle (4mo → 1st warning → 5mo → final warning →
      // 6mo → deactivation). A failure here is silent to the caller, but
      // it must not be silent to us — if these writes start failing in prod,
      // active users would drift into the inactivity cron's scope and be
      // warned/deactivated despite being active. Capture to Sentry.
      prisma.user
        .update({
          where: { id: ctx.userId },
          data: {
            lastActivityAt: new Date(),
            inactivityWarningsSentAt: [],
          },
        })
        .catch((error) => {
          Sentry.captureException(error, {
            tags: { source: "user.getCurrentUser.trackActivity" },
            extra: { userId: ctx.userId },
          });
        });
    }

    return user as FullUser;
  }),

  // Lightweight query to check if current user is a supervisor
  isSupervisor: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { role: true },
    });

    return user?.role === USER_ROLES.SUPERVISOR;
  }),

  // Lightweight query to check if current user is a manager of any team
  isManager: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      return false;
    }

    const count = await prisma.team.count({
      where: {
        managers: {
          some: { id: ctx.userId },
        },
        deletedAt: null,
      },
    });

    return count > 0;
  }),

  // Check if the current user can disable their notifications (set to NONE)
  // Returns false if the user is the last active member with notifications enabled in any of their teams
  canDisableNotifications: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        teams: {
          select: {
            id: true,
            users: {
              where: {
                id: { not: ctx.userId },
                isInactive: null,
                notificationFrequency: { not: NotificationFrequency.NONE },
              },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!user || user.teams.length === 0) {
      return false;
    }

    // All teams must have at least one other notifiable member
    return user.teams.every((team) => team.users.length > 0);
  }),

  // Get full user details for admin edit page
  getFullUserById: protectedProcedure
    .input(z.string())
    .query(async ({ input, ctx }) => {
      // Check if caller is admin
      checkAdminOnly(ctx);

      return prisma.user.findUnique({
        where: { id: input },
        include: {
          teams: {
            where: { deletedAt: null },
            include: {
              organization: true,
              areas: true,
              managers: {
                select: { id: true },
              },
            },
          },
          managedTeams: {
            where: { deletedAt: null },
            include: {
              organization: true,
              areas: true,
            },
          },
          supervisor: {
            include: {
              areas: true,
              organizations: true,
            },
          },
        },
      });
    }),

  // Update user as admin/manager
  updateUser: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        email: z.string().email().transform(normalizeEmail).optional(),
        firstName: z.string().min(1, {
          message: "Veuillez saisir votre prénom.",
        }),
        lastName: z.string().min(1, {
          message: "Veuillez saisir votre nom.",
        }),
        phone: z.string().optional().nullable(),
        profession: z.string().optional().nullable(),
        teamIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check if caller is admin
      checkAdminOnly(ctx);

      // If email is being changed, check it's not already taken
      const normalizedEmail = input.email?.toLowerCase();
      if (normalizedEmail) {
        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });
        if (existingUser && existingUser.id !== input.userId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Cette adresse e-mail est déjà utilisée.",
          });
        }
      }

      const updateData: {
        email?: string;
        firstName: string;
        lastName: string;
        phone?: string | null;
        profession?: string | null;
        teams?: { set: { id: string }[] };
      } = {
        firstName: input.firstName,
        lastName: input.lastName,
      };

      if (normalizedEmail) {
        updateData.email = normalizedEmail;
      }

      if (input.phone !== undefined) {
        updateData.phone = input.phone === "" ? null : input.phone;
      }

      if (input.profession !== undefined) {
        updateData.profession =
          input.profession === "" ? null : input.profession;
      }

      // Update team memberships if provided
      if (input.teamIds !== undefined) {
        updateData.teams = { set: input.teamIds.map((id) => ({ id })) };
      }

      // Check if teams are being removed and process report implications
      if (input.teamIds !== undefined) {
        const currentUser = await prisma.user.findUnique({
          where: { id: input.userId },
          select: {
            firstName: true,
            lastName: true,
            teams: { select: { id: true } },
          },
        });

        const currentTeamIds = currentUser?.teams.map((t) => t.id) ?? [];
        const newTeamIds = new Set(input.teamIds);
        const removedTeamIds = currentTeamIds.filter(
          (id) => !newTeamIds.has(id),
        );

        if (removedTeamIds.length > 0) {
          const removedUserName =
            `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim();

          const allOperations: TransactionOperation[] = [];

          for (const teamId of removedTeamIds) {
            const { operations } = await processTeamRemovalReports(
              prisma,
              input.userId,
              teamId,
              removedUserName,
              ctx.userId,
            );
            allOperations.push(...operations);
          }

          // Execute report operations + user update in a single transaction
          await prisma.$transaction([
            ...allOperations,
            prisma.user.update({
              where: { id: input.userId },
              data: updateData,
            }),
          ]);

          return { success: true };
        }
      }

      await prisma.user.update({
        where: { id: input.userId },
        data: updateData,
      });

      return {
        success: true,
      };
    }),

  getUsers: protectedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).optional(),
          pageSize: z.number().min(1).max(100).optional(),
          search: z.string().optional(),
          excludeInactive: z.boolean().optional(),
          sortBy: z.enum(["member", "role"]).optional(),
          sortOrder: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 10;
      const search = input?.search?.trim();
      const excludeInactive = input?.excludeInactive ?? false;
      const sortBy = input?.sortBy;
      const sortOrder = input?.sortOrder ?? "asc";

      // Get current user's role and managed teams
      const currentUser = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: {
          role: true,
          managedTeams: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
      });

      const isAdmin = currentUser?.role === USER_ROLES.ADMIN;
      const isSupervisor = currentUser?.role === USER_ROLES.SUPERVISOR;
      const managedTeamIds = currentUser?.managedTeams.map((t) => t.id) ?? [];

      // If not admin, not supervisor, and not a manager, return empty result
      if (!isAdmin && !isSupervisor && managedTeamIds.length === 0) {
        return { items: [], total: 0, totalPages: 0 };
      }

      // Build base where clause based on role
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let baseWhereClause: any = {};

      if (isAdmin) {
        baseWhereClause = {};
      } else if (isSupervisor) {
        const supervisor = await prisma.supervisor.findUnique({
          where: { userId: ctx.userId },
          include: { areas: true, organizations: true },
        });

        if (!supervisor) {
          return { items: [], total: 0, totalPages: 0 };
        }

        const areaIds = supervisor.areas.map((a) => a.id);
        const orgIds = supervisor.organizations.map((o) => o.id);

        const teamScope = {
          organizationId: { in: orgIds },
          areas: { some: { id: { in: areaIds } } },
        };

        baseWhereClause = {
          OR: [
            { teams: { some: teamScope } },
            {
              isInactive: { not: null },
              deactivatedTeamSnapshot: {
                teams: { some: teamScope },
              },
            },
          ],
        };
      } else {
        baseWhereClause = {
          OR: [
            {
              teams: {
                some: { id: { in: managedTeamIds } },
              },
            },
            {
              isInactive: { not: null },
              deactivatedTeamSnapshot: {
                teams: {
                  some: { id: { in: managedTeamIds } },
                },
              },
            },
          ],
        };
      }

      // Search with unaccent() for accent-insensitive matching
      const matchingIds = search
        ? await searchWithUnaccent(
            "User",
            ["firstName", "lastName", "email"],
            search,
          )
        : null;

      const inactiveFilter = excludeInactive ? { isInactive: null } : {};

      const whereClause = matchingIds
        ? {
            AND: [
              baseWhereClause,
              { id: { in: matchingIds } },
              { deletedAt: null },
              inactiveFilter,
            ],
          }
        : { AND: [baseWhereClause, { deletedAt: null }, inactiveFilter] };

      const userSelect = {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        profession: true,
        role: true,
        isInactive: true,
        teams: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            role: true,
            organization: {
              select: {
                name: true,
                shortName: true,
              },
            },
            areas: {
              select: {
                id: true,
                name: true,
                inseeCode: true,
              },
            },
          },
        },
        managedTeams: {
          where: { deletedAt: null },
          select: { id: true },
        },
        supervisor: {
          select: {
            areas: {
              select: {
                id: true,
                name: true,
                inseeCode: true,
              },
            },
          },
        },
        deactivatedTeamSnapshot: {
          select: {
            teams: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                role: true,
                organization: {
                  select: {
                    name: true,
                    shortName: true,
                  },
                },
                areas: {
                  select: {
                    id: true,
                    name: true,
                    inseeCode: true,
                  },
                },
              },
            },
          },
        },
      };

      function getUserOrderBy() {
        switch (sortBy) {
          case "member":
            return [{ lastName: sortOrder }, { firstName: sortOrder }];
          default:
            return [
              { lastName: "asc" as const },
              { firstName: "asc" as const },
            ];
        }
      }

      if (sortBy === "role") {
        // Rank ordering ADMIN(0) → SUPERVISOR(1) → MANAGER(2) → USER(3) can't
        // be expressed with a single Prisma orderBy. We split the query into
        // 4 disjoint role buckets, count them in parallel, then fetch only
        // the page slice from the bucket(s) it actually covers — at most 2
        // small findMany calls, no array roundtrip.
        const bucketFilters = [
          { role: USER_ROLES.ADMIN },
          { role: USER_ROLES.SUPERVISOR },
          {
            role: USER_ROLES.USER,
            managedTeams: { some: { deletedAt: null } },
          },
          {
            role: USER_ROLES.USER,
            managedTeams: { none: { deletedAt: null } },
          },
        ];

        const orderedBuckets =
          sortOrder === "desc" ? [...bucketFilters].reverse() : bucketFilters;

        const bucketWheres = orderedBuckets.map((bucket) => ({
          AND: [whereClause, bucket],
        }));

        const counts = await Promise.all(
          bucketWheres.map((where) => prisma.user.count({ where })),
        );
        const total = counts.reduce((a, b) => a + b, 0);

        if (total === 0) {
          return { items: [], total: 0, totalPages: 0 };
        }

        const offset = (page - 1) * pageSize;
        const items: Array<
          Awaited<
            ReturnType<
              typeof prisma.user.findMany<{ select: typeof userSelect }>
            >
          >[number]
        > = [];
        let remaining = pageSize;
        let cursor = 0;

        for (let i = 0; i < bucketWheres.length && remaining > 0; i++) {
          const bucketCount = counts[i];
          if (cursor + bucketCount <= offset) {
            cursor += bucketCount;
            continue;
          }
          const localSkip = Math.max(0, offset - cursor);
          const localTake = Math.min(remaining, bucketCount - localSkip);
          if (localTake > 0) {
            const rows = await prisma.user.findMany({
              where: bucketWheres[i],
              orderBy: [
                { lastName: "asc" as const },
                { firstName: "asc" as const },
              ],
              select: userSelect,
              skip: localSkip,
              take: localTake,
            });
            items.push(...rows);
            remaining -= rows.length;
          }
          cursor += bucketCount;
        }

        return {
          items,
          total,
          totalPages: Math.ceil(total / pageSize),
        };
      }

      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          orderBy: getUserOrderBy(),
          select: userSelect,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.user.count({ where: whereClause }),
      ]);

      return {
        items,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  // Get pending users (invited but not yet registered) - admin, supervisor, or manager
  getPendingUsers: protectedProcedure
    .input(
      z
        .object({
          page: z.number().int().positive().default(1),
          pageSize: z.number().int().min(1).max(100).default(10),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const teamIds = await checkCanManagePendingUsers(ctx);

      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 10;
      const search = input?.search?.trim();

      const matchingIds = search
        ? await searchWithUnaccent(
            "PendingUser",
            ["firstName", "lastName", "email"],
            search,
          )
        : null;

      const whereClause: Record<string, unknown> = {};
      if (matchingIds) {
        whereClause.id = { in: matchingIds };
      }
      if (teamIds) {
        whereClause.teams = { some: { id: { in: teamIds } } };
      }

      const pendingUserSelect = {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        teams: {
          select: {
            id: true,
            name: true,
            areas: {
              select: {
                id: true,
                name: true,
                inseeCode: true,
              },
            },
          },
        },
        managedTeams: {
          select: { id: true },
        },
      };

      const [items, total] = await Promise.all([
        prisma.pendingUser.findMany({
          where: whereClause,
          orderBy: { email: "asc" },
          select: pendingUserSelect,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.pendingUser.count({ where: whereClause }),
      ]);

      return {
        items,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  resendInvitation: protectedProcedure
    .input(z.object({ pendingUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const teamIds = await checkCanManagePendingUsers(ctx);

      const pendingUser = await prisma.pendingUser.findUnique({
        where: { id: input.pendingUserId },
        include: { teams: { select: { id: true } } },
      });

      if (
        pendingUser &&
        teamIds &&
        !pendingUser.teams.some((t) => teamIds.includes(t.id))
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Vous ne pouvez réinviter que les utilisateurs de vos équipes.",
        });
      }

      if (!pendingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Utilisateur en attente non trouvé.",
        });
      }

      // Si un compte existe déjà pour cet email, le pendingUser est un orphelin :
      // renvoyer une invitation mènerait l'utilisateur vers « un compte existe
      // déjà ». On supprime l'orphelin et on signale l'incohérence plutôt que de
      // ré-émettre un lien sans issue.
      const existingUser = await prisma.user.findUnique({
        where: { email: pendingUser.email },
        select: { id: true },
      });
      if (existingUser) {
        await prisma.pendingUser.delete({ where: { id: pendingUser.id } });
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Un compte existe déjà pour cette adresse e-mail. L'invitation en attente a été supprimée.",
        });
      }

      const verificationToken = await createVerificationToken({
        email: pendingUser.email,
        firstName: pendingUser.firstName,
        lastName: pendingUser.lastName,
      });

      await prisma.pendingUser.update({
        where: { id: input.pendingUserId },
        data: {
          verificationToken,
          tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        },
      });

      const linkUrl = `${process.env.NEXT_PUBLIC_APP_URL}${ROUTE.FINISH_REGISTRATION}?token=${verificationToken}`;

      await sendTemplatedEmail("CONFIRM_ACCOUNT", {
        to: [{ email: pendingUser.email, name: pendingUser.email }],
        params: { linkUrl },
      });

      return { success: true };
    }),

  cancelPendingInvitation: protectedProcedure
    .input(z.object({ pendingUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const teamIds = await checkCanManagePendingUsers(ctx);

      const pendingUser = await prisma.pendingUser.findUnique({
        where: { id: input.pendingUserId },
        include: { teams: { select: { id: true } } },
      });

      if (!pendingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Utilisateur en attente non trouvé.",
        });
      }

      if (teamIds && !pendingUser.teams.some((t) => teamIds.includes(t.id))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Vous ne pouvez annuler que les invitations des utilisateurs de vos équipes.",
        });
      }

      await prisma.pendingUser.delete({
        where: { id: input.pendingUserId },
      });

      return { success: true };
    }),

  // Development/staging endpoint for impersonation widget.
  // Gated server-side by ENABLE_DEBUG_TOOLS (non-public env var) so a stray
  // NEXT_PUBLIC_ flag flip in the client bundle cannot expose the directory.
  getAllUsersForDev: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          role: z
            .enum(["ADMIN", "SUPERVISOR", "OPERATOR", "HELPER"])
            .optional(),
          reportId: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      if (!isDebugModeEnabled()) {
        return { users: [], nextCursor: undefined };
      }

      const { search, role, reportId, cursor, limit = 50 } = input ?? {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        // Only show users with credential accounts (can login with password)
        accounts: { some: { providerId: "credential" } },
        // Exclude inactive users
        isInactive: null,
      };

      // Filter by report access: author, co-authors, requested teams members
      if (reportId) {
        const report = await prisma.report.findUnique({
          where: { id: reportId },
          select: {
            authorId: true,
            coAuthors: { select: { id: true } },
            requestedTeams: { select: { id: true } },
          },
        });

        if (report) {
          const userIds = [
            report.authorId,
            ...report.coAuthors.map((u) => u.id),
          ];
          const teamIds = report.requestedTeams.map((t) => t.id);

          where.OR = [
            { id: { in: userIds } },
            ...(teamIds.length > 0
              ? [{ teams: { some: { id: { in: teamIds } } } }]
              : []),
          ];
        }
      } else {
        // Role and search filters only apply when NOT filtering by report
        if (search && search.length > 0) {
          where.OR = [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ];
        }

        if (role === "ADMIN") {
          where.role = "admin";
        } else if (role === "SUPERVISOR") {
          where.role = "supervisor";
        } else if (role === "OPERATOR") {
          where.teams = { some: { role: "OPERATOR" } };
        } else if (role === "HELPER") {
          where.teams = { some: { role: "HELPER" } };
        }
      }

      const users = await prisma.user.findMany({
        where,
        orderBy: { lastName: "asc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          profession: true,
          role: true,
          isInactive: true,
          teams: {
            select: {
              id: true,
              name: true,
              role: true,
              organization: {
                select: {
                  name: true,
                  shortName: true,
                },
              },
              areas: {
                select: {
                  id: true,
                  name: true,
                  inseeCode: true,
                },
              },
            },
          },
          twoFactorEnabled: true,
          managedTeams: {
            select: { id: true },
          },
          supervisor: {
            select: {
              areas: { select: { id: true, name: true } },
              organizations: {
                select: { id: true, name: true, shortName: true },
              },
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (users.length > limit) {
        const nextItem = users.pop();
        nextCursor = nextItem?.id;
      }

      return { users, nextCursor };
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1, {
          message: "Veuillez saisir votre prénom.",
        }),
        lastName: z.string().min(1, {
          message: "Veuillez saisir votre nom.",
        }),
        phone: z.string().optional().nullable(),
        profession: z.string().optional().nullable(),
        notificationFrequency: z
          .enum([
            NotificationFrequency.EACH_SOLICITATION,
            NotificationFrequency.TWICE_DAILY,
            NotificationFrequency.ONCE_DAILY,
            NotificationFrequency.NONE,
          ])
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const wantsNone =
        input.notificationFrequency === NotificationFrequency.NONE;

      // Role gate: only managers (of non-deleted teams) or supervisors can
      // disable notifications. Role doesn't toggle in this flow, so this
      // check stays outside the transaction.
      if (wantsNone) {
        const isSupervisor = ctx.user.role === USER_ROLES.SUPERVISOR;
        if (!isSupervisor) {
          const managerCount = await prisma.team.count({
            where: {
              managers: { some: { id: ctx.userId } },
              deletedAt: null,
            },
          });
          if (managerCount === 0) {
            throw new Error(
              "Seuls les responsables d'équipe ou superviseurs peuvent désactiver les notifications.",
            );
          }
        }
      }

      const updateData: {
        firstName: string;
        lastName: string;
        phone?: string | null;
        profession?: string | null;
        notificationFrequency?: NotificationFrequency;
      } = {
        firstName: input.firstName,
        lastName: input.lastName,
      };

      if (input.phone !== undefined) {
        updateData.phone = input.phone === "" ? null : input.phone;
      }

      if (input.profession !== undefined) {
        updateData.profession =
          input.profession === "" ? null : input.profession;
      }

      if (input.notificationFrequency !== undefined) {
        updateData.notificationFrequency = input.notificationFrequency;
      }

      if (wantsNone) {
        // Race-safe: re-check "last notifiable member" + apply update inside
        // a Serializable transaction. Two managers in the same team toggling
        // NONE concurrently would otherwise both pass the check (each sees
        // the other as still notifiable) and leave the team un-notifiable.
        // Under Serializable, Postgres aborts one tx with 40001; the user
        // retries and sees the real state.
        await prisma.$transaction(
          async (tx) => {
            const userWithTeams = await tx.user.findUnique({
              where: { id: ctx.userId },
              select: {
                teams: {
                  select: {
                    id: true,
                    name: true,
                    users: {
                      where: {
                        id: { not: ctx.userId },
                        isInactive: null,
                        notificationFrequency: {
                          not: NotificationFrequency.NONE,
                        },
                      },
                      select: { id: true },
                      take: 1,
                    },
                  },
                },
              },
            });

            const teamWithoutOtherNotifiable = userWithTeams?.teams.find(
              (team) => team.users.length === 0,
            );
            if (teamWithoutOtherNotifiable) {
              throw new Error(
                `Vous ne pouvez pas désactiver les notifications car vous êtes le dernier membre actif avec des notifications activées dans l'équipe : ${teamWithoutOtherNotifiable.name}.`,
              );
            }

            await tx.user.update({
              where: { id: ctx.userId },
              data: updateData,
            });
          },
          { isolationLevel: "Serializable" },
        );
      } else {
        await prisma.user.update({
          where: { id: ctx.userId },
          data: updateData,
        });
      }

      return {
        success: true,
      };
    }),

  deactivateUser: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // ctx.userId and ctx.user are guaranteed by protectedProcedure

      // Get the target user
      const targetUser = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, role: true, isInactive: true },
      });

      if (!targetUser) {
        throw new Error("Utilisateur non trouvé.");
      }

      // Cannot deactivate admins
      if (targetUser.role === USER_ROLES.ADMIN) {
        throw new Error("Impossible de désactiver un administrateur.");
      }

      // Cannot deactivate yourself
      if (input.userId === ctx.userId) {
        throw new Error("Impossible de désactiver votre propre compte.");
      }

      // Already inactive
      if (targetUser.isInactive) {
        throw new Error("Ce compte est déjà désactivé.");
      }

      // Check authorization: admin, supervisor (scoped), or team manager
      await checkCanDeactivateUser(ctx, input.userId);

      // Get user's current teams, managedTeams, and full name
      const userWithTeams = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          teams: { select: { id: true } },
          managedTeams: { select: { id: true } },
        },
      });

      const teamIds = userWithTeams?.teams.map((t) => t.id) ?? [];
      const managedTeamIds = userWithTeams?.managedTeams.map((t) => t.id) ?? [];

      // Build the deactivated user name for messages
      const deactivatedUserName =
        `${userWithTeams?.firstName ?? ""} ${userWithTeams?.lastName ?? ""}`.trim();

      // Process all reports and get transaction operations
      const { operations: reportOperations, scenarios } =
        await processDeactivationReports(
          prisma,
          input.userId,
          deactivatedUserName,
          ctx.userId,
        );

      // Auto-assign new manager for teams where this user is the only manager
      const managerReassignments: TransactionOperation[] = [];

      for (const teamId of managedTeamIds) {
        // Check if there are other managers for this team
        const otherManagers = await prisma.user.count({
          where: {
            managedTeams: { some: { id: teamId } },
            id: { not: input.userId },
            isInactive: null,
            deletedAt: null,
          },
        });

        if (otherManagers === 0) {
          // Find active members (excluding the user being deactivated)
          const activeMembers = await prisma.user.findMany({
            where: {
              teams: { some: { id: teamId } },
              id: { not: input.userId },
              isInactive: null,
              deletedAt: null,
            },
            select: { id: true },
          });

          if (activeMembers.length > 0) {
            const newManagerId = await findMostActiveTeamMember(
              activeMembers.map((m) => m.id),
              prisma,
            );

            managerReassignments.push(
              prisma.team.update({
                where: { id: teamId },
                data: {
                  managers: { connect: { id: newManagerId } },
                },
              }),
            );
          }
        }
      }

      // Build base transaction operations
      const transactionOperations: TransactionOperation[] = [
        // Create or update snapshot of teams and managedTeams
        prisma.deactivatedUserTeamSnapshot.upsert({
          where: { userId: input.userId },
          create: {
            userId: input.userId,
            teams: { connect: teamIds.map((id) => ({ id })) },
            managedTeams: { connect: managedTeamIds.map((id) => ({ id })) },
          },
          update: {
            teams: { set: teamIds.map((id) => ({ id })) },
            managedTeams: { set: managedTeamIds.map((id) => ({ id })) },
          },
        }),
        // Remove user from all teams
        prisma.user.update({
          where: { id: input.userId },
          data: {
            isInactive: new Date(),
            teams: { set: [] },
            managedTeams: { set: [] },
          },
        }),
        // Delete all sessions
        prisma.session.deleteMany({
          where: { userId: input.userId },
        }),
        // Add report-related operations
        ...reportOperations,
        // Auto-assign new managers for orphaned teams
        ...managerReassignments,
      ];

      // Execute all operations in a single transaction
      await prisma.$transaction(transactionOperations);

      // Révoque les sessions Redis : le deleteMany ci-dessus ne vide que
      // Postgres, sans quoi l'utilisateur désactivé resterait connecté.
      await revokeUserSessions(input.userId);

      // Send deactivation email to the user
      if (userWithTeams?.email) {
        await sendTemplatedEmail("ACCOUNT_DEACTIVATED", {
          to: [{ email: userWithTeams.email }],
          params: {
            userFirstName: userWithTeams.firstName ?? "",
          },
        });
      }

      // Notify the new author(s) who received the deactivated user's reports
      const newAuthorIds = [
        ...new Set(
          scenarios
            .filter((scenario) => scenario.type === "AUTHOR_TRANSFER")
            .map((scenario) => scenario.newAuthorId),
        ),
      ];

      if (newAuthorIds.length > 0) {
        const newAuthors = await prisma.user.findMany({
          where: { id: { in: newAuthorIds } },
          select: { email: true, firstName: true },
        });

        const reportsUrl = `${process.env.NEXT_PUBLIC_APP_URL}${ROUTE.ALL_REPORTS}`;

        await Promise.all(
          newAuthors
            .filter((newAuthor) => newAuthor.email)
            .map((newAuthor) =>
              sendTemplatedEmail("DEACTIVATION_REPORTS_REASSIGNED", {
                to: [{ email: newAuthor.email }],
                params: {
                  userFirstName: newAuthor.firstName ?? "",
                  linkUrl: reportsUrl,
                },
              }),
            ),
        );
      }

      return { success: true };
    }),

  previewDeactivation: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      await checkCanDeactivateUser(ctx, input.userId);

      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          firstName: true,
          lastName: true,
          teams: { select: { id: true, name: true } },
          managedTeams: { select: { id: true, name: true } },
        },
      });

      if (!user) return null;

      const deactivatedUserName =
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();

      const { scenarios } = await processDeactivationReports(
        prisma,
        input.userId,
        deactivatedUserName,
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

      // Preview manager transfers for teams where this user is the only manager
      const managerTransfers: {
        teamName: string;
        newManagerName: string | null;
        hasOtherManagers: boolean;
      }[] = [];

      for (const team of user.managedTeams) {
        const otherManagers = await prisma.user.count({
          where: {
            managedTeams: { some: { id: team.id } },
            id: { not: input.userId },
            isInactive: null,
            deletedAt: null,
          },
        });

        if (otherManagers > 0) {
          managerTransfers.push({
            teamName: team.name,
            newManagerName: null,
            hasOtherManagers: true,
          });
          continue;
        }

        const activeMembers = await prisma.user.findMany({
          where: {
            teams: { some: { id: team.id } },
            id: { not: input.userId },
            isInactive: null,
            deletedAt: null,
          },
          select: { id: true, firstName: true, lastName: true },
        });

        if (activeMembers.length > 0) {
          const newManagerId = await findMostActiveTeamMember(
            activeMembers.map((m) => m.id),
            prisma,
          );
          const newManager = activeMembers.find((m) => m.id === newManagerId);
          managerTransfers.push({
            teamName: team.name,
            newManagerName: newManager
              ? `${newManager.firstName ?? ""} ${newManager.lastName ?? ""}`.trim() ||
                "Utilisateur sans nom"
              : "Inconnu",
            hasOtherManagers: false,
          });
        } else {
          managerTransfers.push({
            teamName: team.name,
            newManagerName: null,
            hasOtherManagers: false,
          });
        }
      }

      return {
        scenarios: enrichedScenarios,
        teams: user.teams.map((t) => t.name),
        managedTeams: user.managedTeams.map((t) => t.name),
        managerTransfers,
      };
    }),

  reactivateUser: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // ctx.userId and ctx.user are guaranteed by protectedProcedure

      const targetUser = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          role: true,
          isInactive: true,
          deletedAt: true,
        },
      });

      if (!targetUser) {
        throw new Error("Utilisateur non trouvé.");
      }

      if (targetUser.deletedAt) {
        throw new Error(
          "Ce compte a été supprimé et ne peut pas être réactivé.",
        );
      }

      if (!targetUser.isInactive) {
        throw new Error("Ce compte est déjà actif.");
      }

      // Get the snapshot if it exists (needed for both authorization and restoration)
      // Only include non-deleted teams to avoid reconnecting to soft-deleted teams
      const snapshot = await prisma.deactivatedUserTeamSnapshot.findUnique({
        where: { userId: input.userId },
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

      const teamIds = snapshot?.teams.map((t) => t.id) ?? [];
      const managedTeamIds = snapshot?.managedTeams.map((t) => t.id) ?? [];

      // Check if caller is admin, supervisor (scoped), or manager of one of the user's former teams
      const isCallerAdmin = ctx.user.role === USER_ROLES.ADMIN;
      const isCallerSupervisor = ctx.user.role === USER_ROLES.SUPERVISOR;
      if (!isCallerAdmin) {
        if (isCallerSupervisor) {
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

          // Check that at least one former team is in the supervisor's scope
          const teamInScope =
            teamIds.length > 0
              ? await prisma.team.findFirst({
                  where: {
                    id: { in: teamIds },
                    organizationId: { in: orgIds },
                    areas: { some: { id: { in: areaIds } } },
                    deletedAt: null,
                  },
                })
              : null;

          if (!teamInScope) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Utilisateur hors de votre périmètre.",
            });
          }
        } else {
          // Check if caller manages any of the teams from the snapshot
          const isManagerOfFormerTeam =
            teamIds.length > 0
              ? await prisma.team.findFirst({
                  where: {
                    id: { in: teamIds },
                    managers: { some: { id: ctx.userId } },
                    deletedAt: null,
                  },
                })
              : null;

          if (!isManagerOfFormerTeam) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Vous devez être administrateur ou manager de l'équipe pour effectuer cette action.",
            });
          }
        }
      }

      // Reactivate user and restore teams from snapshot
      await prisma.$transaction([
        // Reactivate user and restore teams
        prisma.user.update({
          where: { id: input.userId },
          data: {
            isInactive: null,
            notificationsViewedBefore: new Date(),
            teams: { connect: teamIds.map((id) => ({ id })) },
            managedTeams: { connect: managedTeamIds.map((id) => ({ id })) },
          },
        }),
        // Delete the snapshot if it exists
        ...(snapshot
          ? [
              prisma.deactivatedUserTeamSnapshot.delete({
                where: { id: snapshot.id },
              }),
            ]
          : []),
      ]);

      // Send reactivation email to the user
      if (targetUser.email) {
        await sendTemplatedEmail("ACCOUNT_REACTIVATED", {
          to: [{ email: targetUser.email }],
          params: {
            userFirstName: targetUser.firstName ?? "",
            linkUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
          },
        });
      }

      return { success: true };
    }),

  previewSupervisorTransformation: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      checkAdminOnly(ctx);

      if (input.userId === ctx.userId) {
        throw new Error("Impossible de transformer votre propre compte.");
      }

      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          firstName: true,
          lastName: true,
          role: true,
          isInactive: true,
          teams: { select: { id: true, name: true } },
          managedTeams: { select: { id: true, name: true } },
        },
      });

      if (!user) return null;

      if (user.role === USER_ROLES.ADMIN) {
        throw new Error("Impossible de transformer un administrateur.");
      }
      if (user.role === USER_ROLES.SUPERVISOR) {
        throw new Error("Cet utilisateur est déjà superviseur.");
      }
      if (user.isInactive) {
        throw new Error("Ce compte est désactivé.");
      }

      const transformedUserName =
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();

      const { scenarios } = await processDeactivationReports(
        prisma,
        input.userId,
        transformedUserName,
        ctx.userId,
      );

      const reportIds = scenarios.map((s) => s.reportId);
      const reports = await prisma.report.findMany({
        where: { id: { in: reportIds } },
        select: { id: true, subject: true, firstName: true, lastName: true },
      });
      const reportMap = new Map(reports.map((r) => [r.id, r]));

      const newAuthorIds = scenarios
        .filter((s) => s.type === "AUTHOR_TRANSFER")
        .map((s) => (s as { newAuthorId: string }).newAuthorId);

      const newAuthors = await prisma.user.findMany({
        where: { id: { in: newAuthorIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      const authorMap = new Map(newAuthors.map((u) => [u.id, u]));

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

      const managerTransfers: {
        teamName: string;
        newManagerName: string | null;
        hasOtherManagers: boolean;
      }[] = [];

      for (const team of user.managedTeams) {
        const otherManagers = await prisma.user.count({
          where: {
            managedTeams: { some: { id: team.id } },
            id: { not: input.userId },
            isInactive: null,
            deletedAt: null,
          },
        });

        if (otherManagers > 0) {
          managerTransfers.push({
            teamName: team.name,
            newManagerName: null,
            hasOtherManagers: true,
          });
          continue;
        }

        const activeMembers = await prisma.user.findMany({
          where: {
            teams: { some: { id: team.id } },
            id: { not: input.userId },
            isInactive: null,
            deletedAt: null,
          },
          select: { id: true, firstName: true, lastName: true },
        });

        if (activeMembers.length > 0) {
          const newManagerId = await findMostActiveTeamMember(
            activeMembers.map((m) => m.id),
            prisma,
          );
          const newManager = activeMembers.find((m) => m.id === newManagerId);
          managerTransfers.push({
            teamName: team.name,
            newManagerName: newManager
              ? `${newManager.firstName ?? ""} ${newManager.lastName ?? ""}`.trim() ||
                "Utilisateur sans nom"
              : "Inconnu",
            hasOtherManagers: false,
          });
        } else {
          managerTransfers.push({
            teamName: team.name,
            newManagerName: null,
            hasOtherManagers: false,
          });
        }
      }

      return {
        scenarios: enrichedScenarios,
        teams: user.teams.map((t) => t.name),
        managedTeams: user.managedTeams.map((t) => t.name),
        managerTransfers,
      };
    }),

  transformToSupervisor: protectedProcedure
    .input(
      z
        .object({
          userId: z.string(),
          areaIds: z.array(z.string()),
          organizationIds: z.array(z.string()),
        })
        .refine((d) => d.areaIds.length + d.organizationIds.length > 0, {
          message: "Sélectionnez au moins un territoire ou une organisation.",
          path: ["areaIds"],
        }),
    )
    .mutation(async ({ input, ctx }) => {
      checkAdminOnly(ctx);

      if (input.userId === ctx.userId) {
        throw new Error("Impossible de transformer votre propre compte.");
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          isInactive: true,
          teams: { select: { id: true } },
          managedTeams: { select: { id: true } },
        },
      });

      if (!targetUser) {
        throw new Error("Utilisateur non trouvé.");
      }
      if (targetUser.role === USER_ROLES.ADMIN) {
        throw new Error("Impossible de transformer un administrateur.");
      }
      if (targetUser.role === USER_ROLES.SUPERVISOR) {
        throw new Error("Cet utilisateur est déjà superviseur.");
      }
      if (targetUser.isInactive) {
        throw new Error("Ce compte est désactivé.");
      }

      const managedTeamIds = targetUser.managedTeams.map((t) => t.id);

      const transformedUserName =
        `${targetUser.firstName ?? ""} ${targetUser.lastName ?? ""}`.trim();

      const { operations: reportOperations } = await processDeactivationReports(
        prisma,
        input.userId,
        transformedUserName,
        ctx.userId,
      );

      // Auto-assign new manager for teams where this user is the only manager
      const managerReassignments: TransactionOperation[] = [];

      for (const teamId of managedTeamIds) {
        const otherManagers = await prisma.user.count({
          where: {
            managedTeams: { some: { id: teamId } },
            id: { not: input.userId },
            isInactive: null,
            deletedAt: null,
          },
        });

        if (otherManagers === 0) {
          const activeMembers = await prisma.user.findMany({
            where: {
              teams: { some: { id: teamId } },
              id: { not: input.userId },
              isInactive: null,
              deletedAt: null,
            },
            select: { id: true },
          });

          if (activeMembers.length > 0) {
            const newManagerId = await findMostActiveTeamMember(
              activeMembers.map((m) => m.id),
              prisma,
            );

            managerReassignments.push(
              prisma.team.update({
                where: { id: teamId },
                data: {
                  managers: { connect: { id: newManagerId } },
                },
              }),
            );
          }
        }
      }

      const transactionOperations: TransactionOperation[] = [
        // Promote user to supervisor and remove from all teams
        prisma.user.update({
          where: { id: input.userId },
          data: {
            role: USER_ROLES.SUPERVISOR,
            teams: { set: [] },
            managedTeams: { set: [] },
          },
        }),
        // Create supervisor record with selected scope
        prisma.supervisor.create({
          data: {
            userId: input.userId,
            areas: { connect: input.areaIds.map((id) => ({ id })) },
            organizations: {
              connect: input.organizationIds.map((id) => ({ id })),
            },
          },
        }),
        // Invalidate sessions: role changed, scope changed
        prisma.session.deleteMany({
          where: { userId: input.userId },
        }),
        ...reportOperations,
        ...managerReassignments,
      ];

      await prisma.$transaction(transactionOperations);

      // Révoque aussi les sessions Redis : sinon l'utilisateur garde son
      // ancien rôle/périmètre en session jusqu'à expiration du TTL.
      await revokeUserSessions(input.userId);

      return { success: true };
    }),

  /**
   * Validates a verification token and returns the pending user data.
   * Called on page load to pre-fill the form or show an error.
   */
  validateToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const pendingUser = await prisma.pendingUser.findUnique({
        where: { verificationToken: input.token },
        include: {
          teams: {
            select: {
              id: true,
              name: true,
              organization: {
                select: {
                  name: true,
                  shortName: true,
                },
              },
            },
          },
          managedTeams: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!pendingUser) {
        return {
          valid: false,
          error: "TOKEN_INVALID",
          pendingUser: null,
        };
      }

      if (new Date() > pendingUser.tokenExpiresAt) {
        return {
          valid: false,
          error: "TOKEN_EXPIRED",
          pendingUser: null,
        };
      }

      // Check if user already exists with this email
      const existingUser = await prisma.user.findUnique({
        where: { email: pendingUser.email },
      });

      if (existingUser) {
        return {
          valid: false,
          error: "USER_EXISTS",
          pendingUser: null,
        };
      }

      return {
        valid: true,
        error: null,
        pendingUser: {
          email: pendingUser.email,
          firstName: pendingUser.firstName,
          lastName: pendingUser.lastName,
          teams: pendingUser.teams,
          managedTeams: pendingUser.managedTeams,
        },
      };
    }),

  /**
   * Completes the registration process.
   * Creates the user via better-auth, adds teams, and deletes the pending user.
   */
  completeRegistration: publicProcedure
    .input(
      z
        .object({
          token: z.string(),
          firstName: z.string().min(1, "Veuillez saisir votre prénom."),
          lastName: z.string().min(1, "Veuillez saisir votre nom."),
          password: z.string().superRefine((val, ctx) => {
            if (
              val.length < 12 ||
              !/\d/.test(val) ||
              !/[^a-zA-Z0-9]/.test(val)
            ) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                  "Le mot de passe doit contenir au moins 12 caractères, 1 chiffre et 1 caractère spécial.",
              });
            }
          }),
          passwordConfirmation: z.string(),
          phone: z.string().optional().nullable(),
          profession: z.string().optional().nullable(),
          cguAccepted: z.boolean().refine((val) => val === true, {
            message:
              "Vous devez accepter les conditions générales d'utilisation.",
          }),
        })
        .refine((data) => data.password === data.passwordConfirmation, {
          message: "Les mots de passe ne correspondent pas.",
          path: ["passwordConfirmation"],
        }),
    )
    .mutation(async ({ input }) => {
      // Validate token again
      const pendingUser = await prisma.pendingUser.findUnique({
        where: { verificationToken: input.token },
        include: {
          teams: { select: { id: true } },
          managedTeams: { select: { id: true } },
        },
      });

      if (!pendingUser) {
        throw new Error("Token invalide ou expiré.");
      }

      if (new Date() > pendingUser.tokenExpiresAt) {
        throw new Error("Le lien d'invitation a expiré.");
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: pendingUser.email },
      });

      if (existingUser) {
        // Le compte existe déjà mais une invitation en attente subsiste : c'est
        // un orphelin (une finalisation précédente a échoué après la création du
        // compte, avant la suppression du pendingUser). On le nettoie ici pour
        // qu'il cesse de réapparaître dans les listes / d'être réinvité, et on
        // invite l'utilisateur à se connecter.
        await prisma.pendingUser.delete({ where: { id: pendingUser.id } });
        throw new Error(
          "Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.",
        );
      }

      // Use better-auth to create the user with password. Le token validé
      // ci-dessus est transmis au hook /sign-up/email, qui refuse toute
      // inscription sans lui (garde anti pré-emption de compte).
      const headersList = new Headers(await headers());
      headersList.set("x-invitation-token", input.token);
      const response = await auth.api.signUpEmail({
        headers: headersList,
        body: {
          email: pendingUser.email,
          password: input.password,
          name: `${input.firstName} ${input.lastName}`,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      if (!response.user) {
        throw new Error("Erreur lors de la création du compte.");
      }

      // Update user with additional fields and connect teams
      const userId = response.user.id;
      const teamIds = pendingUser.teams.map((t) => ({ id: t.id }));
      const managedTeamIds = pendingUser.managedTeams.map((t) => ({
        id: t.id,
      }));

      // Le compte (response.user) est créé par better-auth HORS transaction et
      // ne peut pas être annulé par Prisma. On regroupe donc toutes les étapes
      // post-création (rattachement équipes + superviseur + suppression de
      // l'invitation) dans une seule transaction atomique. En cas d'échec, on
      // supprime le compte tout juste créé (compensation, cascade sur
      // account/session) afin que la base reste cohérente et que l'utilisateur
      // puisse recliquer son lien sans tomber sur « un compte existe déjà ».
      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: {
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone === "" ? null : input.phone,
              profession: input.profession === "" ? null : input.profession,
              cguAcceptedAt: new Date(),
              teams: { connect: teamIds },
              managedTeams: { connect: managedTeamIds },
            },
          });

          // Check for pending supervisor
          const pendingSupervisor = await tx.pendingSupervisor.findUnique({
            where: { email: pendingUser.email },
            include: {
              areas: { select: { id: true } },
              organizations: { select: { id: true } },
            },
          });

          if (pendingSupervisor) {
            await tx.user.update({
              where: { id: userId },
              data: { role: USER_ROLES.SUPERVISOR },
            });
            await tx.supervisor.create({
              data: {
                userId,
                areas: {
                  connect: pendingSupervisor.areas.map((a) => ({ id: a.id })),
                },
                organizations: {
                  connect: pendingSupervisor.organizations.map((o) => ({
                    id: o.id,
                  })),
                },
              },
            });
            await tx.pendingSupervisor.delete({
              where: { id: pendingSupervisor.id },
            });
          }

          // Delete pending user
          await tx.pendingUser.delete({
            where: { id: pendingUser.id },
          });
        });
      } catch (error) {
        await prisma.user
          .delete({ where: { id: userId } })
          .catch((cleanupError) => {
            console.error(
              `Failed to roll back user ${userId} after registration error:`,
              cleanupError,
            );
            Sentry.captureException(cleanupError);
          });
        // On capture l'erreur d'origine pour enfin observer la cause exacte des
        // échecs de finalisation (rattachement équipe supprimée, etc.).
        Sentry.captureException(error);
        throw new Error(
          "Une erreur est survenue lors de la finalisation de votre compte. Veuillez réessayer.",
        );
      }

      await sendTemplatedEmail("ACCOUNT_CREATED", {
        to: [{ email: pendingUser.email, name: pendingUser.email }],
        params: {
          userFirstName: input.firstName,
          linkUrl: `${process.env.NEXT_PUBLIC_APP_URL}${ROUTE.LOGIN}`,
        },
      });

      return {
        success: true,
        userId: response.user.id,
        email: pendingUser.email,
      };
    }),

  /**
   * Request a password reset email.
   * Always returns success to prevent email enumeration.
   */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email().transform(normalizeEmail) }))
    .mutation(async ({ input }) => {
      const email = input.email;
      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: {
          id: true,
          email: true,
          isInactive: true,
          teams: {
            select: {
              areas: {
                select: { timezone: true },
                take: 1,
              },
            },
            take: 1,
          },
        },
      });

      // Defer all heavy work (DB writes + email) to after the response,
      // and run it whether or not the user exists. The response time then
      // reflects only the initial findFirst, which is identical in both
      // branches — defeating timing-based email enumeration on top of the
      // already-symmetric response body.
      after(async () => {
        if (!user || user.isInactive) {
          return;
        }

        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

        try {
          await prisma.verification.deleteMany({
            where: { identifier: `password-reset:${user.id}` },
          });

          await prisma.verification.create({
            data: {
              id: crypto.randomUUID(),
              identifier: `password-reset:${user.id}`,
              value: hashResetToken(token),
              expiresAt,
            },
          });

          const userTimezone =
            user.teams[0]?.areas[0]?.timezone ?? "Europe/Paris";
          const expiresAtFormatted = expiresAt
            .toLocaleString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: userTimezone,
            })
            .replace(":", "h");

          await sendTemplatedEmail("RESET_PASSWORD", {
            to: [{ email: user.email }],
            params: {
              linkUrl: `${process.env.NEXT_PUBLIC_APP_URL}${ROUTE.NEW_PASSWORD}?token=${token}`,
              expiresAt: expiresAtFormatted,
            },
          });
        } catch (error) {
          Sentry.captureException(error, {
            tags: { source: "user.requestPasswordReset" },
            extra: { userId: user.id },
          });
        }
      });

      return { success: true };
    }),

  /**
   * Validates a password reset token.
   */
  validatePasswordResetToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const verification = await prisma.verification.findFirst({
        where: {
          value: hashResetToken(input.token),
          identifier: { startsWith: "password-reset:" },
        },
      });

      if (!verification) {
        return { valid: false, error: "TOKEN_INVALID" };
      }

      if (new Date() > verification.expiresAt) {
        return { valid: false, error: "TOKEN_EXPIRED" };
      }

      return { valid: true, error: null };
    }),

  /**
   * Reset the password using a valid token.
   */
  resetPassword: publicProcedure
    .input(
      z
        .object({
          token: z.string(),
          password: z.string().superRefine((val, ctx) => {
            if (
              val.length < 12 ||
              !/\d/.test(val) ||
              !/[^a-zA-Z0-9]/.test(val)
            ) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                  "Le mot de passe doit contenir au moins 12 caractères, 1 chiffre et 1 caractère spécial.",
              });
            }
          }),
          passwordConfirmation: z.string(),
        })
        .refine((data) => data.password === data.passwordConfirmation, {
          message: "Les mots de passe ne correspondent pas.",
          path: ["passwordConfirmation"],
        }),
    )
    .mutation(async ({ input }) => {
      // Find the verification record
      const verification = await prisma.verification.findFirst({
        where: {
          value: hashResetToken(input.token),
          identifier: { startsWith: "password-reset:" },
        },
      });

      if (!verification) {
        throw new Error("Le lien de réinitialisation est invalide.");
      }

      if (new Date() > verification.expiresAt) {
        throw new Error("Le lien de réinitialisation a expiré.");
      }

      // Extract user ID from identifier
      const userId = verification.identifier.replace("password-reset:", "");

      // Verify the user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        throw new Error("Compte non trouvé.");
      }

      // Hash the new password using argon2 (must match auth.ts config)
      const argon2 = await import("argon2");
      const hashedPassword = await argon2.hash(input.password);

      // Find or create the user's credential account
      const account = await prisma.account.findFirst({
        where: { userId, providerId: "credential" },
      });

      const accountOperation = account
        ? prisma.account.update({
            where: { id: account.id },
            data: { password: hashedPassword },
          })
        : prisma.account.create({
            data: {
              id: crypto.randomUUID(),
              accountId: user.id,
              providerId: "credential",
              userId: user.id,
              password: hashedPassword,
            },
          });

      // Atomically: update password, consume token, revoke all sessions.
      // Session revocation closes the window where a stolen cookie keeps
      // working after the legitimate user resets their password.
      await prisma.$transaction([
        accountOperation,
        prisma.verification.delete({ where: { id: verification.id } }),
        prisma.session.deleteMany({ where: { userId } }),
      ]);
      // Les sessions vivent dans Redis (secondaryStorage), pas dans la table
      // Postgres : sans cette révocation, un cookie volé resterait valide
      // jusqu'à 7 jours après le reset.
      await revokeUserSessions(userId);

      return { success: true };
    }),
});
