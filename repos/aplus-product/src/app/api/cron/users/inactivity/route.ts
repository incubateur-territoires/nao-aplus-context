import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateCronAuth } from "@/utils/cron-auth";
import { processInactiveUsers } from "@/app/services/user/user-inactivity";
import { postToMattermost } from "@/app/services/mattermost.service";
import { buildInactivitySummaryMessage } from "@/app/services/mattermost-messages";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Inactivity CRON");

export async function GET(request: NextRequest) {
  const authError = validateCronAuth(request.headers.get("authorization"));
  if (authError) return authError;

  logger.info("Started");

  try {
    const result = await processInactiveUsers(prisma);

    // Log results
    logger.info("Processing complete", {
      warned4Months: result.usersWarned4Months.length,
      warned5Months: result.usersWarned5Months.length,
      deactivated: result.usersDeactivated.length,
      errors: result.errors.length,
    });

    // Post summary to Mattermost
    const message = buildInactivitySummaryMessage(result);
    await postToMattermost(message);

    return NextResponse.json({
      message: "Inactivity check complete",
      usersWarned4Months: result.usersWarned4Months.length,
      usersWarned5Months: result.usersWarned5Months.length,
      usersDeactivated: result.usersDeactivated.length,
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
