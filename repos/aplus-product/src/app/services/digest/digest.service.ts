import { PrismaClient, NotificationFrequency } from "@/generated/prisma/client";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import {
  getEligibleUsersForDigest,
  getUnviewedContentForUser,
  updateLastDigestSentAt,
} from "./digest.queries";
import type {
  UserDigestEligibility,
  DigestProcessResult,
  DigestContent,
} from "./digest.types";

const DIGEST_HOURS_TWICE_DAILY = [11, 15];
const DIGEST_HOUR_ONCE_DAILY = 11;
const MIN_DIGEST_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2h minimum between two digests

function getLocalHour(timezone: string, nowUtc: Date): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(nowUtc), 10);
  } catch {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Paris",
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(nowUtc), 10);
  }
}

export function shouldReceiveDigestNow(
  user: UserDigestEligibility,
  nowUtc: Date,
): boolean {
  const localHour = getLocalHour(user.timezone, nowUtc);

  if (user.notificationFrequency === NotificationFrequency.TWICE_DAILY) {
    return DIGEST_HOURS_TWICE_DAILY.includes(localHour);
  }

  if (user.notificationFrequency === NotificationFrequency.ONCE_DAILY) {
    return localHour === DIGEST_HOUR_ONCE_DAILY;
  }

  return false;
}

function formatReportsText(count: number): string {
  if (count === 0) return "";
  if (count === 1) return "1 nouveau signalement à traiter";
  return `${count} nouveaux signalements à traiter`;
}

function formatAnswersText(count: number): string {
  if (count === 0) return "";
  if (count === 1) return "1 nouvelle réponse reçue";
  return `${count} nouvelles réponses reçues`;
}

function formatStatusText(count: number): string {
  if (count === 0) return "";
  if (count === 1) return "1 signalement a changé de statut";
  return `${count} signalements ont changé de statut`;
}

async function sendDigestEmail(
  user: UserDigestEligibility,
  content: DigestContent,
): Promise<{ success: boolean; error?: string }> {
  const result = await sendTemplatedEmail("DIGEST", {
    to: [{ email: user.email, name: user.firstName }],
    params: {
      userFirstName: user.firstName,
      reportsText: formatReportsText(content.unviewedReportsCount),
      answersText: formatAnswersText(content.unviewedAnswersCount),
      statusText: formatStatusText(content.unviewedStatusChangesCount),
    },
  });

  return { success: result.success, error: result.error };
}

interface ProcessDigestOptions {
  force?: boolean;
}

const BATCH_SIZE = 10;

export async function processDigestForAllUsers(
  prisma: PrismaClient,
  options: ProcessDigestOptions = {},
): Promise<DigestProcessResult> {
  const { force = false } = options;
  const nowUtc = new Date();
  const result: DigestProcessResult = {
    usersProcessed: 0,
    emailsSent: 0,
    usersSkipped: 0,
    errors: [],
  };

  const eligibleUsers = await getEligibleUsersForDigest(prisma);

  // Pre-filter by time before any processing (optimization)
  const usersToProcess = force
    ? eligibleUsers
    : eligibleUsers.filter((user) => shouldReceiveDigestNow(user, nowUtc));

  result.usersProcessed = eligibleUsers.length;
  result.usersSkipped = eligibleUsers.length - usersToProcess.length;

  // Process users in parallel batches
  for (let i = 0; i < usersToProcess.length; i += BATCH_SIZE) {
    const batch = usersToProcess.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (user) => {
        if (
          user.lastDigestSentAt &&
          nowUtc.getTime() - user.lastDigestSentAt.getTime() <
            MIN_DIGEST_INTERVAL_MS
        ) {
          return { type: "skipped" as const, userId: user.userId };
        }

        const content = await getUnviewedContentForUser(prisma, user.userId);

        const hasAnyUnviewedContent =
          content.unviewedReportsCount > 0 ||
          content.unviewedAnswersCount > 0 ||
          content.unviewedStatusChangesCount > 0;

        if (!hasAnyUnviewedContent) {
          return { type: "skipped" as const, userId: user.userId };
        }

        const emailResult = await sendDigestEmail(user, content);

        if (emailResult.success) {
          await updateLastDigestSentAt(prisma, user.userId);
          return { type: "sent" as const, userId: user.userId };
        }

        return {
          type: "error" as const,
          userId: user.userId,
          error: emailResult.error ?? "Failed to send email",
        };
      }),
    );

    // Aggregate batch results
    for (const batchResult of batchResults) {
      if (batchResult.status === "fulfilled") {
        const value = batchResult.value;
        if (value.type === "sent") {
          result.emailsSent++;
        } else if (value.type === "skipped") {
          result.usersSkipped++;
        } else if (value.type === "error") {
          result.errors.push({
            userId: value.userId,
            error: value.error,
          });
        }
      } else {
        // Promise rejected
        result.errors.push({
          userId: "unknown",
          error: batchResult.reason?.message || "Unknown batch error",
        });
      }
    }
  }

  return result;
}

export function buildDigestSummaryMessage(result: DigestProcessResult): string {
  const lines: string[] = ["**CRON - Digest de notifications**"];

  lines.push(`> :envelope: **${result.emailsSent}** email(s) envoyé(s)`);

  lines.push(
    `> :fast_forward: **${result.usersSkipped}** utilisateur(s) ignoré(s) (pas l'heure ou rien de nouveau)`,
  );

  if (result.errors.length > 0) {
    const errorList = result.errors
      .map((e) => `  - \`${e.userId.slice(0, 8)}...\` - ${e.error}`)
      .join("\n");
    lines.push(`> :x: **${result.errors.length}** erreur(s)\n${errorList}`);
  }

  if (
    result.emailsSent === 0 &&
    result.usersSkipped === result.usersProcessed &&
    result.errors.length === 0
  ) {
    lines.push(`> Aucun digest à envoyer pour le moment :white_check_mark:`);
  }

  return lines.join("\n\n");
}
