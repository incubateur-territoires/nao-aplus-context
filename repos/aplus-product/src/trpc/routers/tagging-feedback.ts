import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { checkReportAccess } from "../middleware/authorization";
import prisma from "@/lib/prisma";
import {
  TAGGING_AXES,
  taggingFeedbackAxesOf,
  VERDICT_COLUMN_OF,
} from "@/utils/tagging-feedback";

// Seuls les membres d'une équipe destinataire évaluent les tags.
function recipientReport(userId: string) {
  return { requestedTeams: { some: { users: { some: { id: userId } } } } };
}

export const taggingFeedbackRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ ctx, input }) => {
      await checkReportAccess(ctx, input.reportId);

      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { taggingFeedbackHiddenAt: true },
      });
      if (!user || user.taggingFeedbackHiddenAt) {
        return null;
      }

      const tagging = await prisma.reportTagging.findFirst({
        where: {
          reportId: input.reportId,
          report: recipientReport(ctx.userId),
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          procedureLabel: true,
          blockageLabel: true,
          verdicts: {
            where: { userId: ctx.userId },
            select: { procedureIsCorrect: true, blockageIsCorrect: true },
          },
        },
      });
      if (!tagging) {
        return null;
      }

      const axes = taggingFeedbackAxesOf(tagging, tagging.verdicts[0] ?? null);
      return axes.length === 0 ? null : { taggingId: tagging.id, axes };
    }),

  setVerdict: protectedProcedure
    .input(
      z.object({
        taggingId: z.string(),
        axis: z.enum([TAGGING_AXES.PROCEDURE, TAGGING_AXES.BLOCKAGE]),
        isCorrect: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tagging = await prisma.reportTagging.findFirst({
        where: { id: input.taggingId, report: recipientReport(ctx.userId) },
        select: { reportId: true },
      });
      if (!tagging) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cet étiquetage n'existe pas.",
        });
      }
      await checkReportAccess(ctx, tagging.reportId);

      const vote = { [VERDICT_COLUMN_OF[input.axis]]: input.isCorrect };
      await prisma.reportTaggingVerdict.upsert({
        where: {
          taggingId_userId: { taggingId: input.taggingId, userId: ctx.userId },
        },
        create: { taggingId: input.taggingId, userId: ctx.userId, ...vote },
        update: vote,
      });
    }),

  hide: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.user.update({
      where: { id: ctx.userId },
      data: { taggingFeedbackHiddenAt: new Date() },
    });
  }),
});
