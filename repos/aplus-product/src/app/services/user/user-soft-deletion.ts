import { PrismaClient } from "@/generated/prisma/client";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { buildAnonymizedUserData } from "@/utils/anonymize-user";
import { revokeUserSessions } from "@/utils/auth-server";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Soft Deletion CRON");

const DAYS_IN_MS = 24 * 60 * 60 * 1000;
const TWO_YEARS_DAYS = 730;

export interface SoftDeletionUserInfo {
  id: string;
  email: string;
}

export interface SoftDeletionResult {
  usersDeleted: SoftDeletionUserInfo[];
  emailErrors: { userId: string; error: string }[];
  errors: { userId: string; error: string }[];
}

/**
 * Processes soft deletion for users who have been inactive for more than 2 years.
 *
 * Inactivity is measured from the last real activity (`lastActivityAt`, falling
 * back to `createdAt` for users who never logged in) — the same effective date
 * used by the inactivity flow — NOT from the deactivation timestamp. Only
 * already-deactivated accounts (`isInactive` set) are eligible, so they have
 * gone through the warning/deactivation flow first.
 *
 * Rather than hard-deleting (which would break the NOT NULL relations
 * `Report.authorId` / `Answer.authorId`), this sets `deletedAt` and
 * pseudonymizes the agent account in place: the `User` PII fields, the linked
 * `Account` credentials, and removes `Session` / `TwoFactor`. Relations are
 * preserved so referential integrity stays intact.
 *
 * A notification email is sent (best-effort) BEFORE pseudonymization, while the
 * real email address is still available.
 */
export async function processSoftDeletion(
  prisma: PrismaClient,
): Promise<SoftDeletionResult> {
  const result: SoftDeletionResult = {
    usersDeleted: [],
    emailErrors: [],
    errors: [],
  };

  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - TWO_YEARS_DAYS * DAYS_IN_MS);

  const users = await prisma.user.findMany({
    where: {
      // Only already-deactivated accounts are eligible.
      isInactive: { not: null },
      deletedAt: null,
      // 2 years measured from the last real activity, not from deactivation.
      OR: [
        { lastActivityAt: { lte: twoYearsAgo } },
        { lastActivityAt: null, createdAt: { lte: twoYearsAgo } },
      ],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      profession: true,
      internalSupportComment: true,
    },
  });

  for (const user of users) {
    const userInfo: SoftDeletionUserInfo = { id: user.id, email: user.email };

    // Best-effort email: record the error but don't block deletion.
    // Sent BEFORE pseudonymization so the real email is still available.
    const emailResult = await sendTemplatedEmail("ACCOUNT_DELETED", {
      to: [{ email: user.email, name: `${user.firstName} ${user.lastName}` }],
      params: {},
    });
    if (!emailResult.success) {
      const errorMessage = emailResult.error ?? "Unknown error";
      result.emailErrors.push({ userId: user.id, error: errorMessage });
      logger.error("Email error for user", {
        userId: user.id,
        error: errorMessage,
      });
    }

    // Soft delete + pseudonymize the agent account.
    try {
      const anonymized = buildAnonymizedUserData(user.id, {
        phone: user.phone,
      });

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            deletedAt: new Date(),
            firstName: anonymized.firstName,
            lastName: anonymized.lastName,
            name: anonymized.name,
            email: anonymized.email,
            phone: anonymized.phone,
            profession: anonymized.profession,
            internalSupportComment: anonymized.internalSupportComment,
          },
        }),
        // Scrub credentials: accountId is the email for the credential provider.
        prisma.account.updateMany({
          where: { userId: user.id },
          data: { accountId: anonymized.email, password: null },
        }),
        // Remove 2FA secrets and force logout.
        prisma.twoFactor.deleteMany({ where: { userId: user.id } }),
        prisma.session.deleteMany({ where: { userId: user.id } }),
      ]);

      // Les sessions vivent dans Redis (secondaryStorage) : la ligne
      // ci-dessus ne vide que la table Postgres.
      await revokeUserSessions(user.id);

      result.usersDeleted.push(userInfo);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push({ userId: user.id, error: errorMessage });
      logger.error("Error deleting user", { userId: user.id, error });
    }
  }

  return result;
}
