import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateCronAuth } from "@/utils/cron-auth";
import { processSoftDeletion } from "@/app/services/user/user-soft-deletion";
import { postToMattermost } from "@/app/services/mattermost.service";
import { buildSoftDeletionSummaryMessage } from "@/app/services/mattermost-messages";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Soft Deletion CRON");

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request.headers.get("authorization"));
  if (authError) return authError;

  logger.info("Started");

  try {
    const result = await processSoftDeletion(prisma);

    logger.info("Processing complete", {
      usersDeleted: result.usersDeleted.length,
      emailErrors: result.emailErrors.length,
      errors: result.errors.length,
    });

    const message = buildSoftDeletionSummaryMessage(result);
    await postToMattermost(message);

    return NextResponse.json({
      message: "Soft deletion check complete",
      usersDeleted: result.usersDeleted.length,
      emailErrors: result.emailErrors.length,
      errors: result.errors.length,
    });
  } catch (error) {
    logger.error("Error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
