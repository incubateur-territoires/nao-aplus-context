import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateCronAuth } from "@/utils/cron-auth";
import {
  processDigestForAllUsers,
  buildDigestSummaryMessage,
} from "@/app/services/digest/digest.service";
import { postToMattermost } from "@/app/services/mattermost.service";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Digest CRON");

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request.headers.get("authorization"));
  if (authError) return authError;

  // Force parameter to skip time check (for testing)
  const force = request.nextUrl.searchParams.get("force") === "true";

  logger.info("Started", { force });

  try {
    const result = await processDigestForAllUsers(prisma, { force });

    const message = buildDigestSummaryMessage(result);
    await postToMattermost(message);

    return NextResponse.json({
      message: "Digest processing complete",
      usersProcessed: result.usersProcessed,
      emailsSent: result.emailsSent,
      usersSkipped: result.usersSkipped,
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
