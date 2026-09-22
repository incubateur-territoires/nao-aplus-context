import { ReportStatus } from "@/generated/prisma/enums";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Report statuses that are considered "active" (still in progress).
 * Used to determine which reports should receive system notifications
 * when users are deactivated.
 */
export const ACTIVE_REPORT_STATUSES = [
  ReportStatus.PENDING_ASSIGNMENT,
  ReportStatus.IN_TREATMENT,
] as const;

/**
 * Update data for any write that closes a report outside the standard
 * status mutation (`report.updateReportStatus`).
 *
 * Un signalement fermé ne doit jamais rester « en souffrance » : le cron
 * overdue ne cible que les statuts actifs et ne corrigera donc jamais un
 * `overdueAt` laissé sur un signalement clôturé. Toute écriture qui passe
 * un signalement à CLOSED doit réutiliser cet objet.
 */
export const CLOSED_REPORT_DATA = {
  status: ReportStatus.CLOSED,
  overdueAt: null,
} as const;

/**
 * Messages used when deactivating a user and notifying affected reports.
 */
export const DEACTIVATION_MESSAGES = {
  // Author scenarios
  AUTHOR_WITH_COAUTHORS: (name: string) =>
    `<strong>${name}</strong> n'est plus actif. Les co-auteurs devront clôturer ce signalement.`,
  AUTHOR_TRANSFERRED: (name: string, newAuthorName: string) =>
    `<strong>${name}</strong> n'est plus actif. Le signalement a été attribué à <strong>${newAuthorName}</strong>.`,
  AUTHOR_ALONE_CLOSED: (name: string) =>
    `<strong>${name}</strong> n'est plus actif et était le seul membre de son équipe. Ce signalement est désormais clôturé, mais les destinataires peuvent toujours travailler à la résolution de la demande.`,
  COAUTHOR_ONLY: (name: string) => `<strong>${name}</strong> n'est plus actif.`,
  // Recipient scenarios
  RECIPIENT_INACTIVE: (name: string) =>
    `<strong>${name}</strong> n'est plus actif.`,
  RECIPIENT_ALONE_CLOSED: (name: string) =>
    `<strong>${name}</strong> n'est plus actif et était le seul opérateur de son équipe. Ce signalement est désormais clôturé.`,
} as const;

/**
 * Determines the "most active" team member.
 *
 * Activity is measured by the number of answers a member has written: the
 * member with the most answers wins. Ties are broken by the most recent
 * answer. If no member has any answer, the first member is returned.
 *
 * @param teamMemberIds - Array of user IDs to evaluate
 * @param prismaClient - Prisma client instance
 * @returns The user ID of the most active member, or the first member if no activity
 */
export async function findMostActiveTeamMember(
  teamMemberIds: string[],
  prismaClient: PrismaClient,
): Promise<string> {
  if (teamMemberIds.length === 0) {
    throw new Error("No team members provided");
  }

  if (teamMemberIds.length === 1) {
    return teamMemberIds[0];
  }

  // Count answers per member and track each member's most recent answer
  // (used to break ties between members with the same answer count).
  const answerStats = await prismaClient.answer.groupBy({
    by: ["authorId"],
    where: {
      authorId: { in: teamMemberIds },
    },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  let mostActiveId = teamMemberIds[0];
  let bestCount = -1;
  let bestRecency: Date | null = null;

  for (const stat of answerStats) {
    const count = stat._count._all;
    const recency = stat._max.createdAt;

    const isMoreActive =
      count > bestCount ||
      (count === bestCount &&
        recency !== null &&
        (bestRecency === null || recency > bestRecency));

    if (isMoreActive) {
      bestCount = count;
      bestRecency = recency;
      mostActiveId = stat.authorId;
    }
  }

  return mostActiveId;
}
