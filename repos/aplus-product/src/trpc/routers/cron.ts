import { protectedProcedure, createTRPCRouter } from "../init";
import { processDigestForAllUsers } from "@/app/services/digest/digest.service";
import prisma from "@/lib/prisma";
import { isDebugModeEnabled } from "@/utils/debug-mode";

export const cronRouter = createTRPCRouter({
  runDigest: protectedProcedure.mutation(async () => {
    if (!isDebugModeEnabled()) {
      return {
        success: false,
        error: "Debug mode is not enabled",
      };
    }

    try {
      const result = await processDigestForAllUsers(prisma, { force: true });

      return {
        success: true,
        result: {
          usersProcessed: result.usersProcessed,
          emailsSent: result.emailsSent,
          usersSkipped: result.usersSkipped,
          errorsCount: result.errors.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }),
});
