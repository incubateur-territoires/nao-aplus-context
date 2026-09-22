import {
  PrismaClient,
  NotificationFrequency,
  Prisma,
} from "@/generated/prisma/client";
import type { UserDigestEligibility, DigestContent } from "./digest.types";

export async function getEligibleUsersForDigest(
  prisma: PrismaClient,
): Promise<UserDigestEligibility[]> {
  const users = await prisma.user.findMany({
    where: {
      notificationFrequency: {
        in: [
          NotificationFrequency.TWICE_DAILY,
          NotificationFrequency.ONCE_DAILY,
        ],
      },
      isInactive: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastDigestSentAt: true,
      notificationFrequency: true,
      teams: {
        select: {
          areas: {
            select: {
              timezone: true,
            },
          },
        },
      },
    },
  });

  return users.map((user) => {
    const firstAreaWithTimezone = user.teams
      .flatMap((team) => team.areas)
      .find((area) => area.timezone);

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      timezone: firstAreaWithTimezone?.timezone ?? "Europe/Paris",
      lastDigestSentAt: user.lastDigestSentAt,
      notificationFrequency: user.notificationFrequency,
    };
  });
}

export async function getUnviewedContentForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<DigestContent> {
  // Get user's viewed-before cutoff date
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsViewedBefore: true },
  });
  const viewedBefore = user?.notificationsViewedBefore;
  const reportFilter = viewedBefore
    ? Prisma.sql`AND r."createdAt" > ${viewedBefore}`
    : Prisma.empty;
  const answerFilter = viewedBefore
    ? Prisma.sql`AND a."createdAt" > ${viewedBefore}`
    : Prisma.empty;
  const statusFilter = viewedBefore
    ? Prisma.sql`AND rsh."createdAt" > ${viewedBefore}`
    : Prisma.empty;

  // Single SQL query for all unviewed content counts
  const result = await prisma.$queryRaw<
    [
      {
        unviewedReportsCount: bigint;
        unviewedAnswersCount: bigint;
        unviewedStatusChangesCount: bigint;
      },
    ]
  >(Prisma.sql`
    SELECT
      (
        SELECT COUNT(DISTINCT r.id)
        FROM "Report" r
        INNER JOIN "_ReportToRequestedTeams" rt ON r.id = rt."A"
        INNER JOIN "_TeamToUser" tu ON rt."B" = tu."A"
        WHERE tu."B" = ${userId}
          AND r."authorId" != ${userId}
          AND r."status" <> 'DELETED'
          ${reportFilter}
          AND NOT EXISTS (
            SELECT 1 FROM "NotificationView" nv
            WHERE nv."userId" = ${userId}
              AND nv."type" = 'REPORT'
              AND nv."targetId" = r.id
          )
      )::bigint as "unviewedReportsCount",
      (
        SELECT COUNT(DISTINCT a.id)
        FROM "Answer" a
        WHERE a."isMetadataOnly" = false
          AND a."authorId" != ${userId}
          AND EXISTS (
            SELECT 1 FROM "Report" r
            WHERE r.id = a."reportId" AND r."status" <> 'DELETED'
          )
          ${answerFilter}
          AND (
            EXISTS (SELECT 1 FROM "Report" r WHERE r.id = a."reportId" AND r."authorId" = ${userId})
            OR EXISTS (SELECT 1 FROM "_ReportCoAuthors" rc WHERE rc."A" = a."reportId" AND rc."B" = ${userId})
            OR EXISTS (
              SELECT 1 FROM "_ReportToRequestedTeams" rt
              INNER JOIN "_TeamToUser" tu ON rt."B" = tu."A"
              WHERE rt."A" = a."reportId" AND tu."B" = ${userId}
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM "NotificationView" nv
            WHERE nv."userId" = ${userId}
              AND nv."type" = 'ANSWER'
              AND nv."targetId" = a.id
          )
      )::bigint as "unviewedAnswersCount",
      (
        SELECT COUNT(DISTINCT rsh.id)
        FROM "ReportStatusHistory" rsh
        WHERE rsh."authorId" != ${userId}
          AND EXISTS (
            SELECT 1 FROM "Report" r
            WHERE r.id = rsh."reportId" AND r."status" <> 'DELETED'
          )
          ${statusFilter}
          AND (
            EXISTS (SELECT 1 FROM "Report" r WHERE r.id = rsh."reportId" AND r."authorId" = ${userId})
            OR EXISTS (SELECT 1 FROM "_ReportCoAuthors" rc WHERE rc."A" = rsh."reportId" AND rc."B" = ${userId})
          )
          AND NOT EXISTS (
            SELECT 1 FROM "NotificationView" nv
            WHERE nv."userId" = ${userId}
              AND nv."type" = 'STATUS_CHANGE'
              AND nv."targetId" = rsh.id
          )
      )::bigint as "unviewedStatusChangesCount"
  `);

  return {
    unviewedReportsCount: Number(result[0].unviewedReportsCount),
    unviewedAnswersCount: Number(result[0].unviewedAnswersCount),
    unviewedStatusChangesCount: Number(result[0].unviewedStatusChangesCount),
  };
}

export async function updateLastDigestSentAt(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastDigestSentAt: new Date() },
  });
}
