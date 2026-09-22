import { ReportStatus } from "@/generated/prisma/enums";
import {
  classifyAuthorReport,
  classifyRecipientReport,
  AuthorReportData,
  RecipientReportData,
} from "@/app/services/user/user-deactivation";

// Mock the findMostActiveTeamMember function
jest.mock("@/utils/report", () => ({
  ...jest.requireActual("@/utils/report"),
  findMostActiveTeamMember: jest.fn().mockResolvedValue("most-active-user"),
}));

describe("user-deactivation service", () => {
  describe("classifyAuthorReport", () => {
    const mockPrisma = {} as never;
    const userId = "user-to-deactivate";

    it("classifies as COAUTHOR_ONLY when user is not the author", async () => {
      const report: AuthorReportData = {
        id: "report-1",
        authorId: "other-user",
        coAuthors: [{ id: userId }],
        applicantTeam: { users: [] },
      };

      const result = await classifyAuthorReport(report, userId, mockPrisma);

      expect(result).toEqual({
        type: "COAUTHOR_ONLY",
        reportId: "report-1",
      });
    });

    it("classifies as AUTHOR_WITH_COAUTHORS when report has other co-authors", async () => {
      const report: AuthorReportData = {
        id: "report-1",
        authorId: userId,
        coAuthors: [{ id: "other-coauthor" }],
        applicantTeam: { users: [] },
      };

      const result = await classifyAuthorReport(report, userId, mockPrisma);

      expect(result).toEqual({
        type: "AUTHOR_WITH_COAUTHORS",
        reportId: "report-1",
      });
    });

    it("classifies as AUTHOR_TRANSFER when team has other active members", async () => {
      const report: AuthorReportData = {
        id: "report-1",
        authorId: userId,
        coAuthors: [],
        applicantTeam: {
          users: [
            {
              id: "most-active-user",
              firstName: "Fabienne",
              lastName: "Salomon",
            },
            { id: "team-member-2", firstName: "Autre", lastName: "Membre" },
          ],
        },
      };

      const result = await classifyAuthorReport(report, userId, mockPrisma);

      expect(result).toEqual({
        type: "AUTHOR_TRANSFER",
        reportId: "report-1",
        newAuthorId: "most-active-user",
        newAuthorName: "Fabienne Salomon",
        newCoAuthorIds: ["team-member-2"],
      });
    });

    it("classifies as AUTHOR_ALONE_CLOSE when no team members and no co-authors", async () => {
      const report: AuthorReportData = {
        id: "report-1",
        authorId: userId,
        coAuthors: [],
        applicantTeam: { users: [] },
      };

      const result = await classifyAuthorReport(report, userId, mockPrisma);

      expect(result).toEqual({
        type: "AUTHOR_ALONE_CLOSE",
        reportId: "report-1",
      });
    });

    it("classifies as AUTHOR_ALONE_CLOSE when applicantTeam is null", async () => {
      const report: AuthorReportData = {
        id: "report-1",
        authorId: userId,
        coAuthors: [],
        applicantTeam: null,
      };

      const result = await classifyAuthorReport(report, userId, mockPrisma);

      expect(result).toEqual({
        type: "AUTHOR_ALONE_CLOSE",
        reportId: "report-1",
      });
    });

    it("excludes the deactivated user from co-authors when checking", async () => {
      // User is author but also in coAuthors (edge case)
      const report: AuthorReportData = {
        id: "report-1",
        authorId: userId,
        coAuthors: [{ id: userId }], // User is also a co-author
        applicantTeam: { users: [] },
      };

      const result = await classifyAuthorReport(report, userId, mockPrisma);

      // Should be AUTHOR_ALONE_CLOSE because the only co-author is the deactivated user
      expect(result).toEqual({
        type: "AUTHOR_ALONE_CLOSE",
        reportId: "report-1",
      });
    });
  });

  describe("classifyRecipientReport", () => {
    it("classifies as RECIPIENT_ALONE_CLOSE when user is alone in all teams", () => {
      const report: RecipientReportData = {
        id: "report-1",
        status: ReportStatus.IN_TREATMENT,
        requestedTeams: [
          { id: "team-1", users: [] },
          { id: "team-2", users: [] },
        ],
        statusHistory: [],
      };

      const result = classifyRecipientReport(report);

      expect(result).toEqual({
        type: "RECIPIENT_ALONE_CLOSE",
        reportId: "report-1",
      });
    });

    it("classifies as RECIPIENT_HANDLED_REVERT when user handled and team has members", () => {
      const report: RecipientReportData = {
        id: "report-1",
        status: ReportStatus.IN_TREATMENT,
        requestedTeams: [{ id: "team-1", users: [{ id: "other-member" }] }],
        statusHistory: [{ id: "history-1" }], // User handled
      };

      const result = classifyRecipientReport(report);

      expect(result).toEqual({
        type: "RECIPIENT_HANDLED_REVERT",
        reportId: "report-1",
      });
    });

    it("classifies as RECIPIENT_NOT_HANDLED when user did not handle and team has members", () => {
      const report: RecipientReportData = {
        id: "report-1",
        status: ReportStatus.PENDING_ASSIGNMENT,
        requestedTeams: [{ id: "team-1", users: [{ id: "other-member" }] }],
        statusHistory: [], // User did not handle
      };

      const result = classifyRecipientReport(report);

      expect(result).toEqual({
        type: "RECIPIENT_NOT_HANDLED",
        reportId: "report-1",
      });
    });

    it("prioritizes RECIPIENT_ALONE_CLOSE over handled status", () => {
      // User handled but is alone - should close, not revert
      const report: RecipientReportData = {
        id: "report-1",
        status: ReportStatus.IN_TREATMENT,
        requestedTeams: [{ id: "team-1", users: [] }], // Alone
        statusHistory: [{ id: "history-1" }], // Handled
      };

      const result = classifyRecipientReport(report);

      expect(result).toEqual({
        type: "RECIPIENT_ALONE_CLOSE",
        reportId: "report-1",
      });
    });

    it("considers user not alone if ANY team has other members", () => {
      const report: RecipientReportData = {
        id: "report-1",
        status: ReportStatus.IN_TREATMENT,
        requestedTeams: [
          { id: "team-1", users: [] }, // Alone in this team
          { id: "team-2", users: [{ id: "other-member" }] }, // Not alone here
        ],
        statusHistory: [],
      };

      const result = classifyRecipientReport(report);

      // Should NOT close because there's at least one team with members
      expect(result).toEqual({
        type: "RECIPIENT_NOT_HANDLED",
        reportId: "report-1",
      });
    });
  });
});
