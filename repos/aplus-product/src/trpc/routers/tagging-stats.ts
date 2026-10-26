import { adminProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import { taggingStatsOf } from "@/utils/tagging-stats";

export const taggingStatsRouter = createTRPCRouter({
  get: adminProcedure.query(async () => {
    const [taggings, hiddenFeedbackUsers] = await Promise.all([
      prisma.reportTagging.findMany({
        select: {
          reportId: true,
          createdAt: true,
          procedureLabel: true,
          blockageLabel: true,
          verdicts: {
            select: {
              userId: true,
              createdAt: true,
              procedureIsCorrect: true,
              blockageIsCorrect: true,
            },
          },
        },
      }),
      prisma.user.count({ where: { taggingFeedbackHiddenAt: { not: null } } }),
    ]);

    return taggingStatsOf(taggings, hiddenFeedbackUsers);
  }),
});
