import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { ReportStatus } from "@/generated/prisma/enums";
import {
  ACTIVE_REPORT_STATUSES,
  CLOSED_REPORT_DATA,
  findMostActiveTeamMember,
} from "@/utils/report";

export type TransactionOperation = Prisma.PrismaPromise<unknown>;

/**
 * Messages used when removing a user from a team and notifying affected reports.
 */
export const TEAM_REMOVAL_MESSAGES = {
  // Author scenarios
  AUTHOR_WITH_COAUTHORS: (name: string, newAuthorName: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe. Le signalement a été transféré à <strong>${newAuthorName}</strong>.`,
  AUTHOR_TRANSFER: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe. Le signalement a été transféré à un autre membre.`,
  AUTHOR_ALONE_CLOSED: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe et était le seul membre. Ce signalement est désormais clôturé.`,
  COAUTHOR_ONLY: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe.`,
  // Recipient scenarios
  RECIPIENT_REMOVED: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe.`,
  RECIPIENT_ALONE_CLOSED: (name: string) =>
    `<strong>${name}</strong> a été retiré de l'équipe et était le seul opérateur. Ce signalement est désormais clôturé.`,
} as const;

/**
 * Messages used when deleting an entire team.
 */
export const TEAM_DELETION_MESSAGES = {
  APPLICANT_TEAM_CLOSED: (teamName: string) =>
    `L'équipe <strong>${teamName}</strong> a été supprimée. Ce signalement est désormais clôturé.`,
  REQUESTED_TEAM_REMOVED: (teamName: string) =>
    `L'équipe destinataire <strong>${teamName}</strong> a été supprimée.`,
  REQUESTED_TEAM_SOLE_CLOSED: (teamName: string) =>
    `L'équipe destinataire <strong>${teamName}</strong> a été supprimée et était la seule équipe destinataire. Ce signalement est désormais clôturé.`,
} as const;

export type TeamDeletionScenarioType =
  | "APPLICANT_TEAM_CLOSED"
  | "REQUESTED_TEAM_SOLE_CLOSED"
  | "REQUESTED_TEAM_REMOVED";

export interface TeamDeletionScenario {
  type: TeamDeletionScenarioType;
  reportId: string;
}

/**
 * Preview the impact of deleting a team on active reports.
 * Returns scenarios without performing any database changes.
 */
export async function previewTeamDeletionReports(
  prisma: PrismaClient,
  teamId: string,
): Promise<TeamDeletionScenario[]> {
  const scenarios: TeamDeletionScenario[] = [];

  // 1. Reports where this team is the applicantTeam → will be closed
  const applicantReports = await prisma.report.findMany({
    where: {
      applicantTeamId: teamId,
      status: { in: [...ACTIVE_REPORT_STATUSES] },
    },
    select: { id: true },
  });

  for (const report of applicantReports) {
    scenarios.push({
      type: "APPLICANT_TEAM_CLOSED",
      reportId: report.id,
    });
  }

  // 2. Reports where this team is in requestedTeams
  const requestedReports = await prisma.report.findMany({
    where: {
      status: { in: [...ACTIVE_REPORT_STATUSES] },
      requestedTeams: { some: { id: teamId } },
    },
    select: {
      id: true,
      requestedTeams: { select: { id: true } },
    },
  });

  for (const report of requestedReports) {
    const otherTeams = report.requestedTeams.filter((t) => t.id !== teamId);
    const isSoleRequestedTeam = otherTeams.length === 0;

    scenarios.push({
      type: isSoleRequestedTeam
        ? "REQUESTED_TEAM_SOLE_CLOSED"
        : "REQUESTED_TEAM_REMOVED",
      reportId: report.id,
    });
  }

  return scenarios;
}

/**
 * Processes all reports affected by a full team deletion.
 *
 * - applicantTeam reports: close all active reports
 * - requestedTeams reports: disconnect team, close if sole requested team
 */
export async function processTeamDeletionReports(
  prisma: PrismaClient,
  teamId: string,
  teamName: string,
  callerUserId: string,
): Promise<{ operations: TransactionOperation[] }> {
  const operations: TransactionOperation[] = [];

  // 1. Close all active reports where this team is the applicantTeam
  const applicantReports = await prisma.report.findMany({
    where: {
      applicantTeamId: teamId,
      status: { in: [...ACTIVE_REPORT_STATUSES] },
    },
    select: { id: true },
  });

  for (const report of applicantReports) {
    operations.push(
      prisma.report.update({
        where: { id: report.id },
        data: {
          ...CLOSED_REPORT_DATA,
          coAuthors: { set: [] },
        },
      }),
      prisma.reportStatusHistory.create({
        data: {
          reportId: report.id,
          status: ReportStatus.CLOSED,
          authorId: callerUserId,
        },
      }),
      prisma.answer.create({
        data: {
          content: TEAM_DELETION_MESSAGES.APPLICANT_TEAM_CLOSED(teamName),
          reportId: report.id,
          authorId: callerUserId,
          isMetadataOnly: true,
        },
      }),
    );
  }

  // 2. Handle reports where this team is in requestedTeams
  const requestedReports = await prisma.report.findMany({
    where: {
      status: { in: [...ACTIVE_REPORT_STATUSES] },
      requestedTeams: { some: { id: teamId } },
    },
    select: {
      id: true,
      requestedTeams: { select: { id: true } },
    },
  });

  for (const report of requestedReports) {
    const otherTeams = report.requestedTeams.filter((t) => t.id !== teamId);
    const isSoleRequestedTeam = otherTeams.length === 0;

    // Always disconnect the team
    operations.push(
      prisma.report.update({
        where: { id: report.id },
        data: { requestedTeams: { disconnect: { id: teamId } } },
      }),
    );

    if (isSoleRequestedTeam) {
      // Close the report + history + message
      operations.push(
        prisma.report.update({
          where: { id: report.id },
          data: CLOSED_REPORT_DATA,
        }),
        prisma.reportStatusHistory.create({
          data: {
            reportId: report.id,
            status: ReportStatus.CLOSED,
            authorId: callerUserId,
          },
        }),
        prisma.answer.create({
          data: {
            content:
              TEAM_DELETION_MESSAGES.REQUESTED_TEAM_SOLE_CLOSED(teamName),
            reportId: report.id,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      );
    } else {
      // Just send a message
      operations.push(
        prisma.answer.create({
          data: {
            content: TEAM_DELETION_MESSAGES.REQUESTED_TEAM_REMOVED(teamName),
            reportId: report.id,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      );
    }
  }

  return { operations };
}

/**
 * Types for classifying reports into team removal scenarios
 */
export type AuthorRemovalScenario =
  | {
      type: "AUTHOR_WITH_COAUTHORS";
      reportId: string;
      newAuthorId: string;
      newAuthorName: string;
      newCoAuthorIds: string[];
    }
  | {
      type: "AUTHOR_TRANSFER";
      reportId: string;
      newAuthorId: string;
      newCoAuthorIds: string[];
    }
  | { type: "AUTHOR_ALONE_CLOSE"; reportId: string }
  | { type: "COAUTHOR_ONLY"; reportId: string };

export type RecipientRemovalScenario =
  | { type: "RECIPIENT_ALONE_CLOSE"; reportId: string }
  | { type: "RECIPIENT_HANDLED_REVERT"; reportId: string }
  | { type: "RECIPIENT_NOT_HANDLED"; reportId: string };

export type TeamRemovalScenario =
  | AuthorRemovalScenario
  | RecipientRemovalScenario;

/**
 * Report data structure returned by the author reports query
 */
interface AuthorReportData {
  id: string;
  authorId: string;
  coAuthors: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  applicantTeam: {
    users: { id: string }[];
  } | null;
}

/**
 * Report data structure returned by the recipient reports query
 */
interface RecipientReportData {
  id: string;
  status: ReportStatus;
  requestedTeams: {
    id: string;
    users: { id: string }[];
  }[];
}

/**
 * Fetches reports where the user is an author or co-author AND the report belongs to the specific team
 */
async function fetchTeamAuthorReports(
  prisma: PrismaClient,
  userId: string,
  teamId: string,
): Promise<AuthorReportData[]> {
  return prisma.report.findMany({
    where: {
      status: { in: [...ACTIVE_REPORT_STATUSES] },
      applicantTeamId: teamId, // Only reports from this specific team
      OR: [{ authorId: userId }, { coAuthors: { some: { id: userId } } }],
    },
    select: {
      id: true,
      authorId: true,
      coAuthors: { select: { id: true, firstName: true, lastName: true } },
      applicantTeam: {
        select: {
          users: {
            where: {
              isInactive: null,
              id: { not: userId }, // Exclude the user being removed
            },
            select: { id: true },
          },
        },
      },
    },
  });
}

/**
 * Fetches reports where the user is a recipient via this specific team (but not author/co-author)
 */
async function fetchTeamRecipientReports(
  prisma: PrismaClient,
  userId: string,
  teamId: string,
): Promise<RecipientReportData[]> {
  return prisma.report.findMany({
    where: {
      status: { in: [...ACTIVE_REPORT_STATUSES] },
      requestedTeams: {
        some: {
          id: teamId, // Only reports where this team is a recipient
          users: { some: { id: userId } },
        },
      },
      NOT: {
        OR: [{ authorId: userId }, { coAuthors: { some: { id: userId } } }],
      },
    },
    select: {
      id: true,
      status: true,
      requestedTeams: {
        select: {
          id: true,
          users: {
            where: {
              isInactive: null,
              id: { not: userId }, // Exclude the user being removed
            },
            select: { id: true },
          },
        },
      },
    },
  });
}

/**
 * Classifies an author/co-author report into the appropriate scenario
 */
async function classifyAuthorReport(
  report: AuthorReportData,
  userId: string,
  prisma: PrismaClient,
): Promise<AuthorRemovalScenario> {
  const isAuthor = report.authorId === userId;
  const otherCoAuthors = report.coAuthors.filter((ca) => ca.id !== userId);
  const activeTeamMembers = report.applicantTeam?.users ?? [];

  if (!isAuthor) {
    return { type: "COAUTHOR_ONLY", reportId: report.id };
  }

  if (otherCoAuthors.length > 0) {
    const coAuthorIds = otherCoAuthors.map((ca) => ca.id);
    const newAuthorId = await findMostActiveTeamMember(coAuthorIds, prisma);
    const newAuthor = otherCoAuthors.find((ca) => ca.id === newAuthorId)!;
    const newAuthorName = `${newAuthor.firstName} ${newAuthor.lastName}`;
    const newCoAuthorIds = coAuthorIds.filter((id) => id !== newAuthorId);

    return {
      type: "AUTHOR_WITH_COAUTHORS",
      reportId: report.id,
      newAuthorId,
      newAuthorName,
      newCoAuthorIds,
    };
  }

  if (activeTeamMembers.length > 0) {
    const teamMemberIds = activeTeamMembers.map((u) => u.id);
    const newAuthorId = await findMostActiveTeamMember(teamMemberIds, prisma);
    const newCoAuthorIds = teamMemberIds.filter((id) => id !== newAuthorId);

    return {
      type: "AUTHOR_TRANSFER",
      reportId: report.id,
      newAuthorId,
      newCoAuthorIds,
    };
  }

  return { type: "AUTHOR_ALONE_CLOSE", reportId: report.id };
}

/**
 * Classifies a recipient report into the appropriate scenario
 */
function classifyRecipientReport(
  report: RecipientReportData,
  teamId: string,
): RecipientRemovalScenario {
  const isAloneInRemovedTeam = report.requestedTeams
    .filter((team) => team.id === teamId)
    .every((team) => team.users.length === 0);
  const hasActiveUsersInOtherTeams = report.requestedTeams
    .filter((team) => team.id !== teamId)
    .some((team) => team.users.length > 0);

  if (isAloneInRemovedTeam && !hasActiveUsersInOtherTeams) {
    return { type: "RECIPIENT_ALONE_CLOSE", reportId: report.id };
  }

  return { type: "RECIPIENT_NOT_HANDLED", reportId: report.id };
}

/**
 * Builds transaction operations for an author scenario
 */
function buildAuthorScenarioOperations(
  scenario: AuthorRemovalScenario,
  removedUserId: string,
  removedUserName: string,
  callerUserId: string,
  prisma: PrismaClient,
): TransactionOperation[] {
  switch (scenario.type) {
    case "COAUTHOR_ONLY":
      return [
        prisma.report.update({
          where: { id: scenario.reportId },
          data: {
            coAuthors: {
              disconnect: { id: removedUserId },
            },
          },
        }),
        prisma.answer.create({
          data: {
            content: TEAM_REMOVAL_MESSAGES.COAUTHOR_ONLY(removedUserName),
            reportId: scenario.reportId,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      ];

    case "AUTHOR_WITH_COAUTHORS":
      return [
        prisma.report.update({
          where: { id: scenario.reportId },
          data: {
            authorId: scenario.newAuthorId,
            coAuthors: {
              set: scenario.newCoAuthorIds.map((id) => ({ id })),
            },
          },
        }),
        prisma.answer.create({
          data: {
            content: TEAM_REMOVAL_MESSAGES.AUTHOR_WITH_COAUTHORS(
              removedUserName,
              scenario.newAuthorName,
            ),
            reportId: scenario.reportId,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      ];

    case "AUTHOR_TRANSFER":
      return [
        prisma.report.update({
          where: { id: scenario.reportId },
          data: {
            authorId: scenario.newAuthorId,
            coAuthors: {
              set: scenario.newCoAuthorIds.map((id) => ({ id })),
            },
          },
        }),
        prisma.answer.create({
          data: {
            content: TEAM_REMOVAL_MESSAGES.AUTHOR_TRANSFER(removedUserName),
            reportId: scenario.reportId,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      ];

    case "AUTHOR_ALONE_CLOSE":
      return [
        prisma.report.update({
          where: { id: scenario.reportId },
          data: CLOSED_REPORT_DATA,
        }),
        prisma.reportStatusHistory.create({
          data: {
            reportId: scenario.reportId,
            status: ReportStatus.CLOSED,
            authorId: callerUserId,
          },
        }),
        prisma.answer.create({
          data: {
            content: TEAM_REMOVAL_MESSAGES.AUTHOR_ALONE_CLOSED(removedUserName),
            reportId: scenario.reportId,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      ];
  }
}

/**
 * Builds transaction operations for a recipient scenario
 */
function buildRecipientScenarioOperations(
  scenario: RecipientRemovalScenario,
  removedUserName: string,
  callerUserId: string,
  prisma: PrismaClient,
): TransactionOperation[] {
  switch (scenario.type) {
    case "RECIPIENT_ALONE_CLOSE":
      return [
        prisma.report.update({
          where: { id: scenario.reportId },
          data: CLOSED_REPORT_DATA,
        }),
        prisma.reportStatusHistory.create({
          data: {
            reportId: scenario.reportId,
            status: ReportStatus.CLOSED,
            authorId: callerUserId,
          },
        }),
        prisma.answer.create({
          data: {
            content:
              TEAM_REMOVAL_MESSAGES.RECIPIENT_ALONE_CLOSED(removedUserName),
            reportId: scenario.reportId,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      ];

    case "RECIPIENT_HANDLED_REVERT":
      return [
        prisma.report.update({
          where: { id: scenario.reportId },
          data: { status: ReportStatus.PENDING_ASSIGNMENT },
        }),
        prisma.reportStatusHistory.create({
          data: {
            reportId: scenario.reportId,
            status: ReportStatus.PENDING_ASSIGNMENT,
            authorId: callerUserId,
          },
        }),
        prisma.answer.create({
          data: {
            content: TEAM_REMOVAL_MESSAGES.RECIPIENT_REMOVED(removedUserName),
            reportId: scenario.reportId,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      ];

    case "RECIPIENT_NOT_HANDLED":
      return [
        prisma.answer.create({
          data: {
            content: TEAM_REMOVAL_MESSAGES.RECIPIENT_REMOVED(removedUserName),
            reportId: scenario.reportId,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      ];
  }
}

/**
 * Processes all reports for a user being removed from a team and returns transaction operations
 */
export async function processTeamRemovalReports(
  prisma: PrismaClient,
  userId: string,
  teamId: string,
  removedUserName: string,
  callerUserId: string,
): Promise<{
  operations: TransactionOperation[];
  scenarios: TeamRemovalScenario[];
}> {
  // Fetch all affected reports for this team
  const [authorReports, recipientReports] = await Promise.all([
    fetchTeamAuthorReports(prisma, userId, teamId),
    fetchTeamRecipientReports(prisma, userId, teamId),
  ]);

  const operations: TransactionOperation[] = [];
  const scenarios: TeamRemovalScenario[] = [];

  // Process author reports
  for (const report of authorReports) {
    const scenario = await classifyAuthorReport(report, userId, prisma);
    scenarios.push(scenario);
    operations.push(
      ...buildAuthorScenarioOperations(
        scenario,
        userId,
        removedUserName,
        callerUserId,
        prisma,
      ),
    );
  }

  // Process recipient reports
  for (const report of recipientReports) {
    const scenario = classifyRecipientReport(report, teamId);
    scenarios.push(scenario);
    operations.push(
      ...buildRecipientScenarioOperations(
        scenario,
        removedUserName,
        callerUserId,
        prisma,
      ),
    );
  }

  return { operations, scenarios };
}
