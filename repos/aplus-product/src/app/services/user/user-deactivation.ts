import { PrismaClient, Prisma } from "@/generated/prisma/client";

export type TransactionOperation = Prisma.PrismaPromise<unknown>;
import { ReportStatus } from "@/generated/prisma/enums";
import {
  ACTIVE_REPORT_STATUSES,
  CLOSED_REPORT_DATA,
  DEACTIVATION_MESSAGES,
  findMostActiveTeamMember,
} from "@/utils/report";

/**
 * Types for classifying reports into deactivation scenarios
 */
export type AuthorScenario =
  | { type: "AUTHOR_WITH_COAUTHORS"; reportId: string }
  | {
      type: "AUTHOR_TRANSFER";
      reportId: string;
      newAuthorId: string;
      newAuthorName: string;
      newCoAuthorIds: string[];
    }
  | { type: "AUTHOR_ALONE_CLOSE"; reportId: string }
  | { type: "COAUTHOR_ONLY"; reportId: string };

export type RecipientScenario =
  | { type: "RECIPIENT_ALONE_CLOSE"; reportId: string }
  | { type: "RECIPIENT_HANDLED_REVERT"; reportId: string }
  | { type: "RECIPIENT_NOT_HANDLED"; reportId: string };

export type DeactivationScenario = AuthorScenario | RecipientScenario;

/**
 * Report data structure returned by the author reports query
 */
export interface AuthorReportData {
  id: string;
  authorId: string;
  coAuthors: { id: string }[];
  applicantTeam: {
    users: { id: string; firstName: string; lastName: string }[];
  } | null;
}

/**
 * Report data structure returned by the recipient reports query
 */
export interface RecipientReportData {
  id: string;
  status: ReportStatus;
  requestedTeams: {
    id: string;
    users: { id: string }[];
  }[];
  statusHistory: { id: string }[];
}

/**
 * Fetches reports where the user is an author or co-author
 */
async function fetchAuthorReports(
  prisma: PrismaClient,
  userId: string,
): Promise<AuthorReportData[]> {
  return prisma.report.findMany({
    where: {
      status: { in: [...ACTIVE_REPORT_STATUSES] },
      OR: [{ authorId: userId }, { coAuthors: { some: { id: userId } } }],
    },
    select: {
      id: true,
      authorId: true,
      coAuthors: { select: { id: true } },
      applicantTeam: {
        select: {
          users: {
            where: {
              isInactive: null,
              id: { not: userId },
            },
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });
}

/**
 * Fetches reports where the user is a recipient (but not author/co-author)
 */
async function fetchRecipientReports(
  prisma: PrismaClient,
  userId: string,
): Promise<RecipientReportData[]> {
  return prisma.report.findMany({
    where: {
      status: { in: [...ACTIVE_REPORT_STATUSES] },
      requestedTeams: {
        some: {
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
        where: {
          users: { some: { id: userId } },
        },
        select: {
          id: true,
          users: {
            where: {
              isInactive: null,
              id: { not: userId },
            },
            select: { id: true },
          },
        },
      },
      statusHistory: {
        where: {
          authorId: userId,
          status: ReportStatus.IN_TREATMENT,
        },
        select: { id: true },
      },
    },
  });
}

/**
 * Classifies an author/co-author report into the appropriate scenario
 */
export async function classifyAuthorReport(
  report: AuthorReportData,
  userId: string,
  prisma: PrismaClient,
): Promise<AuthorScenario> {
  const isAuthor = report.authorId === userId;
  const otherCoAuthors = report.coAuthors.filter((ca) => ca.id !== userId);
  const activeTeamMembers = report.applicantTeam?.users ?? [];

  if (!isAuthor) {
    return { type: "COAUTHOR_ONLY", reportId: report.id };
  }

  if (otherCoAuthors.length > 0) {
    return { type: "AUTHOR_WITH_COAUTHORS", reportId: report.id };
  }

  if (activeTeamMembers.length > 0) {
    const teamMemberIds = activeTeamMembers.map((u) => u.id);
    const newAuthorId = await findMostActiveTeamMember(teamMemberIds, prisma);
    const newAuthor = activeTeamMembers.find((u) => u.id === newAuthorId)!;
    const newAuthorName = `${newAuthor.firstName} ${newAuthor.lastName}`;
    const newCoAuthorIds = teamMemberIds.filter((id) => id !== newAuthorId);

    return {
      type: "AUTHOR_TRANSFER",
      reportId: report.id,
      newAuthorId,
      newAuthorName,
      newCoAuthorIds,
    };
  }

  return { type: "AUTHOR_ALONE_CLOSE", reportId: report.id };
}

/**
 * Classifies a recipient report into the appropriate scenario
 */
export function classifyRecipientReport(
  report: RecipientReportData,
): RecipientScenario {
  const hasHandledReport = report.statusHistory.length > 0;
  const isAloneInTeam = report.requestedTeams.every(
    (team) => team.users.length === 0,
  );

  if (isAloneInTeam) {
    return { type: "RECIPIENT_ALONE_CLOSE", reportId: report.id };
  }

  if (hasHandledReport) {
    return { type: "RECIPIENT_HANDLED_REVERT", reportId: report.id };
  }

  return { type: "RECIPIENT_NOT_HANDLED", reportId: report.id };
}

/**
 * Builds transaction operations for an author scenario
 */
function buildAuthorScenarioOperations(
  scenario: AuthorScenario,
  deactivatedUserName: string,
  callerUserId: string,
  prisma: PrismaClient,
): TransactionOperation[] {
  switch (scenario.type) {
    case "COAUTHOR_ONLY":
      return [
        prisma.answer.create({
          data: {
            content: DEACTIVATION_MESSAGES.COAUTHOR_ONLY(deactivatedUserName),
            reportId: scenario.reportId,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      ];

    case "AUTHOR_WITH_COAUTHORS":
      return [
        prisma.answer.create({
          data: {
            content:
              DEACTIVATION_MESSAGES.AUTHOR_WITH_COAUTHORS(deactivatedUserName),
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
            content: DEACTIVATION_MESSAGES.AUTHOR_TRANSFERRED(
              deactivatedUserName,
              scenario.newAuthorName,
            ),
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
            content:
              DEACTIVATION_MESSAGES.AUTHOR_ALONE_CLOSED(deactivatedUserName),
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
  scenario: RecipientScenario,
  deactivatedUserName: string,
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
              DEACTIVATION_MESSAGES.RECIPIENT_ALONE_CLOSED(deactivatedUserName),
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
            content:
              DEACTIVATION_MESSAGES.RECIPIENT_INACTIVE(deactivatedUserName),
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
            content:
              DEACTIVATION_MESSAGES.RECIPIENT_INACTIVE(deactivatedUserName),
            reportId: scenario.reportId,
            authorId: callerUserId,
            isMetadataOnly: true,
          },
        }),
      ];
  }
}

/**
 * Processes all reports for a user being deactivated and returns transaction operations
 */
export async function processDeactivationReports(
  prisma: PrismaClient,
  userId: string,
  deactivatedUserName: string,
  callerUserId: string,
): Promise<{
  operations: TransactionOperation[];
  scenarios: DeactivationScenario[];
}> {
  // Fetch all affected reports
  const [authorReports, recipientReports] = await Promise.all([
    fetchAuthorReports(prisma, userId),
    fetchRecipientReports(prisma, userId),
  ]);

  const operations: TransactionOperation[] = [];
  const scenarios: DeactivationScenario[] = [];

  // Process author reports
  for (const report of authorReports) {
    const scenario = await classifyAuthorReport(report, userId, prisma);
    scenarios.push(scenario);
    operations.push(
      ...buildAuthorScenarioOperations(
        scenario,
        deactivatedUserName,
        callerUserId,
        prisma,
      ),
    );
  }

  // Process recipient reports
  for (const report of recipientReports) {
    const scenario = classifyRecipientReport(report);
    scenarios.push(scenario);
    operations.push(
      ...buildRecipientScenarioOperations(
        scenario,
        deactivatedUserName,
        callerUserId,
        prisma,
      ),
    );
  }

  return { operations, scenarios };
}
