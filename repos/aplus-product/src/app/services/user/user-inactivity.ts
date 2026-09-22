import { PrismaClient } from "@/generated/prisma/client";
import { USER_ROLES } from "@/constants/user-roles";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { ROUTE } from "@/app/constant/route";
import {
  processDeactivationReports,
  TransactionOperation,
} from "./user-deactivation";
import { findMostActiveTeamMember } from "@/utils/report";
import { revokeUserSessions } from "@/utils/auth-server";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Inactivity CRON");

// Time constants in milliseconds
const DAYS_IN_MS = 24 * 60 * 60 * 1000;
const FOUR_MONTHS_DAYS = 120;
const FIVE_MONTHS_DAYS = 150;
const SIX_MONTHS_DAYS = 180;

export interface InactivityUserInfo {
  id: string;
  email: string;
}

export interface InactivityCheckResult {
  usersWarned4Months: InactivityUserInfo[];
  usersWarned5Months: InactivityUserInfo[];
  usersDeactivated: InactivityUserInfo[];
  errors: { userId: string; error: string }[];
}

interface InactiveUserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  lastActivityAt: Date | null;
  inactivityWarningsSentAt: Date[];
  createdAt: Date;
  teams: { id: string }[];
  managedTeams: { id: string }[];
}

/**
 * Gets the effective last activity date for a user.
 * Uses lastActivityAt if available, otherwise falls back to createdAt.
 */
function getLastActivityDate(user: InactiveUserData): Date {
  return user.lastActivityAt ?? user.createdAt;
}

/**
 * Calculates how many days since the user's last activity.
 */
function getDaysSinceLastActivity(user: InactiveUserData): number {
  const lastActivity = getLastActivityDate(user);
  const now = new Date();
  return Math.floor((now.getTime() - lastActivity.getTime()) / DAYS_IN_MS);
}

/**
 * Checks how many warnings have been sent to the user.
 */
function getWarningCount(user: InactiveUserData): number {
  return user.inactivityWarningsSentAt.length;
}

/**
 * Sends the first inactivity warning email (4 months).
 */
async function sendFirstWarningEmail(user: InactiveUserData): Promise<void> {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}${ROUTE.LOGIN}`;

  await sendTemplatedEmail("INACTIVITY_WARNING_FIRST", {
    to: [{ email: user.email, name: `${user.firstName} ${user.lastName}` }],
    params: {
      userFirstName: user.firstName,
      loginUrl,
    },
  });
}

/**
 * Sends the final inactivity warning email (5 months).
 */
async function sendFinalWarningEmail(user: InactiveUserData): Promise<void> {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}${ROUTE.LOGIN}`;

  await sendTemplatedEmail("INACTIVITY_WARNING_FINAL", {
    to: [{ email: user.email, name: `${user.firstName} ${user.lastName}` }],
    params: {
      userFirstName: user.firstName,
      loginUrl,
    },
  });
}

/**
 * Sends the account deactivated email (6 months).
 */
async function sendDeactivationEmail(user: InactiveUserData): Promise<void> {
  await sendTemplatedEmail("ACCOUNT_DEACTIVATED_INACTIVITY", {
    to: [{ email: user.email, name: `${user.firstName} ${user.lastName}` }],
    params: {
      userFirstName: user.firstName,
    },
  });
}

/**
 * Deactivates a user due to inactivity.
 * Reuses the existing deactivation logic from user-deactivation.ts
 */
async function deactivateUserForInactivity(
  prisma: PrismaClient,
  user: InactiveUserData,
): Promise<void> {
  // Re-fetch teams from DB to get up-to-date state
  // (user data may be stale if another user was processed earlier in the same batch)
  const freshUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      teams: { select: { id: true } },
      managedTeams: { select: { id: true } },
    },
  });

  const teamIds = freshUser.teams.map((t) => t.id);
  const managedTeamIds = freshUser.managedTeams.map((t) => t.id);
  const deactivatedUserName = `${user.firstName} ${user.lastName}`.trim();

  // Process reports - using the user's own ID as the "caller" for automated deactivation
  const { operations: reportOperations } = await processDeactivationReports(
    prisma,
    user.id,
    deactivatedUserName,
    user.id,
  );

  // Auto-assign new manager for teams where this user is the only manager
  const managerReassignments: TransactionOperation[] = [];

  for (const teamId of managedTeamIds) {
    const otherManagers = await prisma.user.count({
      where: {
        managedTeams: { some: { id: teamId } },
        id: { not: user.id },
        isInactive: null,
        deletedAt: null,
      },
    });

    if (otherManagers === 0) {
      const activeMembers = await prisma.user.findMany({
        where: {
          teams: { some: { id: teamId } },
          id: { not: user.id },
          isInactive: null,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (activeMembers.length > 0) {
        const newManagerId = await findMostActiveTeamMember(
          activeMembers.map((m) => m.id),
          prisma,
        );

        managerReassignments.push(
          prisma.team.update({
            where: { id: teamId },
            data: {
              managers: { connect: { id: newManagerId } },
            },
          }),
        );
      }
    }
  }

  const transactionOperations: TransactionOperation[] = [
    // Create or update snapshot of teams and managedTeams
    prisma.deactivatedUserTeamSnapshot.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        teams: { connect: teamIds.map((id) => ({ id })) },
        managedTeams: { connect: managedTeamIds.map((id) => ({ id })) },
      },
      update: {
        teams: { set: teamIds.map((id) => ({ id })) },
        managedTeams: { set: managedTeamIds.map((id) => ({ id })) },
      },
    }),
    // Remove user from all teams and mark as inactive
    prisma.user.update({
      where: { id: user.id },
      data: {
        isInactive: new Date(),
        teams: { set: [] },
        managedTeams: { set: [] },
      },
    }),
    // Delete all sessions (table Postgres ; les sessions actives vivent dans
    // Redis et sont révoquées après la transaction)
    prisma.session.deleteMany({
      where: { userId: user.id },
    }),
    // Add report-related operations
    ...reportOperations,
    // Auto-assign new managers for orphaned teams
    ...managerReassignments,
  ];

  await prisma.$transaction(transactionOperations);

  // Les sessions vivent dans Redis (secondaryStorage) : sans cette
  // révocation, le compte désactivé garderait un accès jusqu'à 7 jours.
  await revokeUserSessions(user.id);
}

/**
 * Main function to check all users for inactivity and process accordingly.
 */
export async function processInactiveUsers(
  prisma: PrismaClient,
): Promise<InactivityCheckResult> {
  const result: InactivityCheckResult = {
    usersWarned4Months: [],
    usersWarned5Months: [],
    usersDeactivated: [],
    errors: [],
  };

  const now = new Date();
  const fourMonthsAgo = new Date(now.getTime() - FOUR_MONTHS_DAYS * DAYS_IN_MS);

  // Fetch all active, non-admin users who might need processing
  // (users with lastActivityAt older than 4 months, or never logged in and created > 4 months ago)
  const users = await prisma.user.findMany({
    where: {
      isInactive: null,
      role: { not: USER_ROLES.ADMIN },
      OR: [
        { lastActivityAt: { lt: fourMonthsAgo } },
        { lastActivityAt: null, createdAt: { lt: fourMonthsAgo } },
      ],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      lastActivityAt: true,
      inactivityWarningsSentAt: true,
      createdAt: true,
      teams: { select: { id: true } },
      managedTeams: { select: { id: true } },
    },
  });

  for (const user of users) {
    try {
      const daysSinceActivity = getDaysSinceLastActivity(user);
      const warningCount = getWarningCount(user);

      const userInfo = { id: user.id, email: user.email };

      // 6+ months: Deactivate (must have received both warnings first)
      if (daysSinceActivity >= SIX_MONTHS_DAYS && warningCount >= 2) {
        await deactivateUserForInactivity(prisma, user);
        await sendDeactivationEmail(user);
        result.usersDeactivated.push(userInfo);
        continue;
      }

      // 5+ months: Send final warning (if first warning already sent)
      if (daysSinceActivity >= FIVE_MONTHS_DAYS && warningCount === 1) {
        await sendFinalWarningEmail(user);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            inactivityWarningsSentAt: {
              push: new Date(),
            },
          },
        });
        result.usersWarned5Months.push(userInfo);
        continue;
      }

      // 4+ months: Send first warning (if no warnings sent yet)
      if (daysSinceActivity >= FOUR_MONTHS_DAYS && warningCount === 0) {
        await sendFirstWarningEmail(user);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            inactivityWarningsSentAt: {
              push: new Date(),
            },
          },
        });
        result.usersWarned4Months.push(userInfo);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push({ userId: user.id, error: errorMessage });
      logger.error("Error processing user", { userId: user.id, error });
    }
  }

  return result;
}
