import z from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import prisma from "@/lib/prisma";
import {
  maskAnswersForRole,
  getMaskingRole,
} from "@/utils/mask-sensitive-data";
import { Prisma } from "@/generated/prisma/client";
import {
  ReportStatus,
  NotificationFrequency,
  NotificationType,
} from "@/generated/prisma/client";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { buildReportUrl } from "@/utils/report-url";
import { clientReportStatusSchema } from "@/utils/report-status-input";
import { checkReportAccess } from "../middleware/authorization";

const CreateAnswerResponse = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  answerId: z.string().optional(),
});

interface Recipient {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  notificationFrequency: NotificationFrequency;
}

function getFullName(user: {
  firstName: string | null;
  lastName: string | null;
}) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

interface SendAnswerNotificationParams {
  answerId: string;
  authorId: string;
  reportId: string;
  isOperatorOnly?: boolean;
}

async function sendAnswerNotificationEmails({
  answerId,
  authorId,
  reportId,
  isOperatorOnly,
}: SendAnswerNotificationParams) {
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { email: true, firstName: true, lastName: true },
  });

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      subject: true,
      author: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          notificationFrequency: true,
        },
      },
      coAuthors: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          notificationFrequency: true,
        },
      },
      requestedTeams: {
        select: {
          users: {
            where: { isInactive: null },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              notificationFrequency: true,
            },
          },
        },
      },
    },
  });

  if (!author || !report) return;

  const requestedTeamsUsers = report.requestedTeams.flatMap(
    (team) => team.users,
  );

  // For private messages (isOperatorOnly), only notify requested teams users
  // For regular messages, notify everyone (author + co-authors + requested teams)
  const allRecipients: Recipient[] = isOperatorOnly
    ? requestedTeamsUsers
    : [report.author, ...report.coAuthors, ...requestedTeamsUsers];

  // Deduplicate by email, exclude the answer author, and filter by notification preferences
  // Only send immediate notifications to users with EACH_SOLICITATION frequency
  const uniqueRecipients = Array.from(
    new Map(allRecipients.map((u) => [u.email, u])).values(),
  )
    .filter((recipient) => recipient.id !== authorId)
    .filter(
      (recipient) =>
        recipient.notificationFrequency ===
        NotificationFrequency.EACH_SOLICITATION,
    );

  if (uniqueRecipients.length === 0) return;

  const authorFullName = getFullName(author);
  const answerUrl = `${buildReportUrl(reportId)}#answer-${answerId}`;

  await Promise.all(
    uniqueRecipients.map((recipient) =>
      sendTemplatedEmail("ANSWER_CREATED", {
        to: [{ email: recipient.email, name: getFullName(recipient) }],
        params: {
          userFirstName: recipient.firstName ?? "",
          authorFullName,
          answerUrl,
          reportName: report.subject,
        },
        replyTo: { email: author.email, name: authorFullName },
      }),
    ),
  );
}

export const answerRouter = createTRPCRouter({
  getAnswersWithStatusHistory: protectedProcedure
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

      const [answers, statusHistory] = await prisma.$transaction([
        prisma.answer.findMany({
          where: {
            reportId: input,
            // Helpers must not see operator-only answers
            ...(isHelper ? { isOperatorOnly: false } : {}),
          },
          include: {
            report: {
              include: {
                applicantTeam: true,
                requestedTeams: true,
              },
            },
            author: {
              include: {
                teams: {
                  include: {
                    organization: true,
                  },
                },
              },
            },
            files: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.reportStatusHistory.findMany({
          where: { reportId: input },
          include: {
            author: true,
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      return {
        answers: maskAnswersForRole(
          answers,
          getMaskingRole(ctx.user.role, ctx.impersonatedBy),
        ),
        statusHistory,
      };
    }),
  getAnswersByRequestId: protectedProcedure
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

      const answers = await prisma.answer.findMany({
        where: {
          reportId: input,
          // Helpers must not see operator-only answers
          ...(isHelper ? { isOperatorOnly: false } : {}),
        },
        include: {
          report: {
            include: {
              applicantTeam: true,
            },
          },
          author: {
            include: {
              teams: {
                include: {
                  organization: true,
                },
              },
            },
          },
          files: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return maskAnswersForRole(
        answers,
        getMaskingRole(ctx.user.role, ctx.impersonatedBy),
      );
    }),

  createAnswer: protectedProcedure
    .input(
      z.object({
        newReportStatus: clientReportStatusSchema.optional(),
        // Réouverture d'un signalement fermé : le serveur résout lui-même le
        // statut cible depuis l'historique (En attente de prise en charge si le
        // signalement n'avait jamais été pris en charge, sinon En cours de
        // traitement), en ignorant newReportStatus.
        reopenFromClosed: z.boolean().optional(),
        isIrrelevant: z.boolean().optional(),
        isOperatorOnly: z.boolean().optional(),
        reportId: z.string(),
        content: z
          .string()
          .min(1, "Le contenu de la réponse ne peut pas être vide"),
        isMetadataOnly: z.boolean().optional(),
        files: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              size: z.number(),
              lastModified: z.date(),
            }),
          )
          .default([]),
      }),
    )
    .output(CreateAnswerResponse)
    .mutation(
      async ({ input, ctx }): Promise<z.infer<typeof CreateAnswerResponse>> => {
        await checkReportAccess(ctx, input.reportId);
        try {
          // ctx.userId is guaranteed by protectedProcedure
          const userId = ctx.userId;

          // Use transaction to ensure data consistency
          const result = await prisma.$transaction(async (tx) => {
            // Create the answer first
            const answer = await tx.answer.create({
              data: {
                content: input.content,
                reportId: input.reportId,
                authorId: userId,
                isOperatorOnly: input.isOperatorOnly,
                isIrrelevant: input.isIrrelevant,
                isMetadataOnly: input.isMetadataOnly,
              },
              select: { id: true },
            });

            // Create files in the database if any exist
            if (input.files.length > 0) {
              await tx.file.createMany({
                data: input.files.map((file) => ({
                  id: file.id,
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  lastModified: new Date(file.lastModified),
                  reportId: input.reportId,
                })),
              });

              // Connect the files to the answer
              await tx.answer.update({
                where: { id: answer.id },
                data: {
                  files: {
                    connect: input.files.map((file) => ({
                      id: file.id,
                    })),
                  },
                },
              });
            }

            await tx.report.update({
              where: { id: input.reportId },
              data: {
                lastAnswerAt: new Date(),
              },
            });

            if (input.newReportStatus || input.reopenFromClosed) {
              const current = await tx.report.findUnique({
                where: { id: input.reportId },
                select: { status: true },
              });

              let targetStatus = input.newReportStatus;

              if (input.reopenFromClosed) {
                if (current?.status !== ReportStatus.CLOSED) {
                  throw new TRPCError({
                    code: "CONFLICT",
                    message: "Le signalement n'est pas fermé.",
                  });
                }

                // Restaure le statut d'avant la fermeture : un signalement qui
                // n'avait jamais été pris en charge revient à PENDING_ASSIGNMENT,
                // sinon il repasse En cours de traitement (et non Traité).
                const previousStatus = await tx.reportStatusHistory.findFirst({
                  where: {
                    reportId: input.reportId,
                    status: {
                      notIn: [ReportStatus.CLOSED, ReportStatus.DELETED],
                    },
                  },
                  orderBy: { createdAt: "desc" },
                  select: { status: true },
                });
                targetStatus =
                  !previousStatus ||
                  previousStatus.status === ReportStatus.PENDING_ASSIGNMENT
                    ? ReportStatus.PENDING_ASSIGNMENT
                    : ReportStatus.IN_TREATMENT;
              } else if (current?.status === targetStatus) {
                throw new TRPCError({
                  code: "CONFLICT",
                  message: `Le signalement est déjà au statut ${targetStatus}.`,
                });
              }

              if (targetStatus) {
                await tx.report.update({
                  where: { id: input.reportId },
                  data: {
                    status: targetStatus,
                    overdueAt: null,
                  },
                });

                await tx.reportStatusHistory.create({
                  data: {
                    reportId: input.reportId,
                    status: targetStatus,
                    authorId: userId, // Use the current user, not the report author
                    answerId: answer.id,
                  },
                });
              }
            }

            return answer;
          });

          // Send email notification (skip for metadata-only messages)
          if (!input.isMetadataOnly) {
            try {
              await sendAnswerNotificationEmails({
                answerId: result.id,
                authorId: userId,
                reportId: input.reportId,
                isOperatorOnly: input.isOperatorOnly,
              });
            } catch (emailError) {
              console.error(
                "Failed to send answer notification emails:",
                emailError,
              );
            }
          }

          return {
            success: true,
            answerId: result.id,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("Error creating answer:", error);
          return {
            success: false,
            message:
              "Une erreur est survenue lors de la création de la réponse.",
          };
        }
      },
    ),

  markAnswerAsViewed: protectedProcedure
    .input(z.object({ answerId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ctx.userId is guaranteed by protectedProcedure
      await prisma.notificationView.upsert({
        where: {
          userId_type_targetId: {
            userId: ctx.userId,
            type: NotificationType.ANSWER,
            targetId: input.answerId,
          },
        },
        update: {},
        create: {
          userId: ctx.userId,
          type: NotificationType.ANSWER,
          targetId: input.answerId,
        },
      });

      return { success: true };
    }),

  markAnswersAsViewed: protectedProcedure
    .input(z.object({ answerIds: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      // ctx.userId is guaranteed by protectedProcedure
      // Use createMany with skipDuplicates to efficiently mark multiple answers
      await prisma.notificationView.createMany({
        data: input.answerIds.map((answerId) => ({
          userId: ctx.userId,
          type: NotificationType.ANSWER,
          targetId: answerId,
        })),
        skipDuplicates: true,
      });

      return { success: true };
    }),

  markStatusChangeAsViewed: protectedProcedure
    .input(z.object({ statusHistoryId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await prisma.notificationView.upsert({
        where: {
          userId_type_targetId: {
            userId: ctx.userId,
            type: NotificationType.STATUS_CHANGE,
            targetId: input.statusHistoryId,
          },
        },
        update: {},
        create: {
          userId: ctx.userId,
          type: NotificationType.STATUS_CHANGE,
          targetId: input.statusHistoryId,
        },
      });

      return { success: true };
    }),

  markStatusChangesAsViewed: protectedProcedure
    .input(z.object({ statusHistoryIds: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      await prisma.notificationView.createMany({
        data: input.statusHistoryIds.map((statusHistoryId) => ({
          userId: ctx.userId,
          type: NotificationType.STATUS_CHANGE,
          targetId: statusHistoryId,
        })),
        skipDuplicates: true,
      });

      return { success: true };
    }),

  markReportAsViewed: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await prisma.notificationView.upsert({
        where: {
          userId_type_targetId: {
            userId: ctx.userId,
            type: NotificationType.REPORT,
            targetId: input.reportId,
          },
        },
        update: {},
        create: {
          userId: ctx.userId,
          type: NotificationType.REPORT,
          targetId: input.reportId,
        },
      });

      return { success: true };
    }),

  getUnreadCountsByReports: protectedProcedure
    .input(z.object({ reportIds: z.array(z.string()) }))
    .query(async ({ input, ctx }) => {
      if (input.reportIds.length === 0) {
        return { counts: {}, unviewedReportIds: [] };
      }

      // Get current user's role (helper vs operator) and viewed-before cutoff
      const currentUser = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: {
          notificationsViewedBefore: true,
          teams: {
            select: { role: true },
          },
        },
      });

      const isHelper = currentUser?.teams?.some(
        (team) => team.role === "HELPER",
      );

      // Build conditional operator-only filter for helpers
      const operatorOnlyFilter = isHelper
        ? Prisma.sql`AND a."isOperatorOnly" = false`
        : Prisma.empty;

      // Filter out content created before the user's viewed-before cutoff date
      const viewedBefore = currentUser?.notificationsViewedBefore;
      const answerViewedBeforeFilter = viewedBefore
        ? Prisma.sql`AND a."createdAt" > ${viewedBefore}`
        : Prisma.empty;
      const statusViewedBeforeFilter = viewedBefore
        ? Prisma.sql`AND rsh."createdAt" > ${viewedBefore}`
        : Prisma.empty;
      const reportViewedBeforeFilter = viewedBefore
        ? Prisma.sql`AND r."createdAt" > ${viewedBefore}`
        : Prisma.empty;

      // Single SQL query for unread counts per report
      const unreadCounts = await prisma.$queryRaw<
        { reportId: string; answerCount: bigint; statusCount: bigint }[]
      >(Prisma.sql`
        SELECT
          r.id as "reportId",
          COALESCE(answer_counts.unread_count, 0) as "answerCount",
          COALESCE(status_counts.unread_count, 0) as "statusCount"
        FROM "Report" r
        LEFT JOIN LATERAL (
          SELECT COUNT(*) as unread_count
          FROM "Answer" a
          WHERE a."reportId" = r.id
            AND a."authorId" != ${ctx.userId}
            AND a."isMetadataOnly" = false
            ${operatorOnlyFilter}
            ${answerViewedBeforeFilter}
            AND NOT EXISTS (
              SELECT 1 FROM "NotificationView" nv
              WHERE nv."userId" = ${ctx.userId}
                AND nv."type" = 'ANSWER'
                AND nv."targetId" = a.id
            )
        ) answer_counts ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) as unread_count
          FROM "ReportStatusHistory" rsh
          WHERE rsh."reportId" = r.id
            AND rsh."authorId" != ${ctx.userId}
            ${statusViewedBeforeFilter}
            AND NOT EXISTS (
              SELECT 1 FROM "NotificationView" nv
              WHERE nv."userId" = ${ctx.userId}
                AND nv."type" = 'STATUS_CHANGE'
                AND nv."targetId" = rsh.id
            )
        ) status_counts ON true
        WHERE r.id = ANY(${input.reportIds})
          AND r."status" <> 'DELETED'
      `);

      // Separate query for unviewed reports (for blue dot indicator)
      const unviewedReports = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT r.id
          FROM "Report" r
          WHERE r.id = ANY(${input.reportIds})
            AND r."status" <> 'DELETED'
            AND r."authorId" != ${ctx.userId}
            ${reportViewedBeforeFilter}
            AND NOT EXISTS (
              SELECT 1 FROM "NotificationView" nv
              WHERE nv."userId" = ${ctx.userId}
                AND nv."type" = 'REPORT'
                AND nv."targetId" = r.id
            )
        `,
      );

      const counts: Record<string, number> = {};
      for (const row of unreadCounts) {
        const total = Number(row.answerCount);
        if (total > 0) {
          counts[row.reportId] = total;
        }
      }

      return {
        counts,
        unviewedReportIds: unviewedReports.map((r) => r.id),
      };
    }),
});
