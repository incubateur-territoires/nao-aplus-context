import { ReportStatus } from "@/generated/prisma/enums";

// We need to import the types but not the actual functions yet
// because we need to mock findMostActiveTeamMember first
jest.mock("@/utils/report", () => ({
  ...jest.requireActual("@/utils/report"),
  findMostActiveTeamMember: jest.fn().mockResolvedValue("most-active-user"),
}));

// Now import after mocking
import {
  processTeamRemovalReports,
  processTeamDeletionReports,
  TEAM_DELETION_MESSAGES,
} from "./user-team-removal";

// Mock Prisma client - using unknown to satisfy PrismaClient type parameter
// while still allowing us to access mock methods
const mockPrisma = {
  report: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  answer: {
    create: jest.fn(),
  },
  reportStatusHistory: {
    create: jest.fn(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe("user-team-removal service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processTeamRemovalReports", () => {
    const userId = "user-to-remove";
    const teamId = "team-123";
    const userName = "John Doe";
    const callerUserId = "caller-user";

    it("returns empty arrays when no reports are affected", async () => {
      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // author reports
        .mockResolvedValueOnce([]); // recipient reports

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.operations).toHaveLength(0);
      expect(result.scenarios).toHaveLength(0);
    });

    it("classifies COAUTHOR_ONLY when user is not the author", async () => {
      const authorReports = [
        {
          id: "report-1",
          authorId: "other-user",
          coAuthors: [{ id: userId }],
          applicantTeam: { users: [] },
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(authorReports)
        .mockResolvedValueOnce([]);

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0]).toEqual({
        type: "COAUTHOR_ONLY",
        reportId: "report-1",
      });
      // Should create two operations: disconnect coAuthor + answer
      expect(result.operations).toHaveLength(2);
    });

    it("classifies AUTHOR_WITH_COAUTHORS when report has other co-authors", async () => {
      const authorReports = [
        {
          id: "report-1",
          authorId: userId,
          coAuthors: [
            { id: "most-active-user", firstName: "Jane", lastName: "Smith" },
            { id: "other-coauthor", firstName: "Bob", lastName: "Wilson" },
          ],
          applicantTeam: { users: [] },
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(authorReports)
        .mockResolvedValueOnce([]);

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0]).toEqual({
        type: "AUTHOR_WITH_COAUTHORS",
        reportId: "report-1",
        newAuthorId: "most-active-user",
        newAuthorName: "Jane Smith",
        newCoAuthorIds: ["other-coauthor"],
      });
      // Should create report update + answer operations
      expect(result.operations).toHaveLength(2);
    });

    it("classifies AUTHOR_TRANSFER when team has other active members", async () => {
      const authorReports = [
        {
          id: "report-1",
          authorId: userId,
          coAuthors: [],
          applicantTeam: {
            users: [{ id: "team-member-1" }, { id: "team-member-2" }],
          },
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(authorReports)
        .mockResolvedValueOnce([]);

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0]).toEqual({
        type: "AUTHOR_TRANSFER",
        reportId: "report-1",
        newAuthorId: "most-active-user",
        newCoAuthorIds: ["team-member-1", "team-member-2"],
      });
      // Should create report update + answer operations
      expect(result.operations).toHaveLength(2);
    });

    it("classifies AUTHOR_ALONE_CLOSE when no team members and no co-authors", async () => {
      const authorReports = [
        {
          id: "report-1",
          authorId: userId,
          coAuthors: [],
          applicantTeam: { users: [] },
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(authorReports)
        .mockResolvedValueOnce([]);

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0]).toEqual({
        type: "AUTHOR_ALONE_CLOSE",
        reportId: "report-1",
      });
      // Should create report update + status history + answer operations
      expect(result.operations).toHaveLength(3);
    });

    it("classifies RECIPIENT_ALONE_CLOSE when user is alone in team", async () => {
      const recipientReports = [
        {
          id: "report-2",
          status: ReportStatus.IN_TREATMENT,
          requestedTeams: [{ id: teamId, users: [] }],
          statusHistory: [],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(recipientReports);

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0]).toEqual({
        type: "RECIPIENT_ALONE_CLOSE",
        reportId: "report-2",
      });
    });

    it("does not close report when user is alone in removed team but other requestedTeams have active users", async () => {
      const recipientReports = [
        {
          id: "report-2",
          status: ReportStatus.IN_TREATMENT,
          requestedTeams: [
            { id: teamId, users: [] }, // No one left in the removed team
            { id: "other-team", users: [{ id: "active-member" }] }, // Other team still active
          ],
          statusHistory: [],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(recipientReports);

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0]).toEqual({
        type: "RECIPIENT_NOT_HANDLED",
        reportId: "report-2",
      });
    });

    it("classifies RECIPIENT_NOT_HANDLED when user handled but team still has members", async () => {
      const recipientReports = [
        {
          id: "report-2",
          status: ReportStatus.IN_TREATMENT,
          requestedTeams: [{ id: teamId, users: [{ id: "other-member" }] }],
          statusHistory: [{ id: "history-1" }],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(recipientReports);

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0]).toEqual({
        type: "RECIPIENT_NOT_HANDLED",
        reportId: "report-2",
      });
    });

    it("classifies RECIPIENT_NOT_HANDLED when user did not handle and team has members", async () => {
      const recipientReports = [
        {
          id: "report-2",
          status: ReportStatus.PENDING_ASSIGNMENT,
          requestedTeams: [{ id: teamId, users: [{ id: "other-member" }] }],
          statusHistory: [],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(recipientReports);

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0]).toEqual({
        type: "RECIPIENT_NOT_HANDLED",
        reportId: "report-2",
      });
    });

    it("processes multiple reports of different types", async () => {
      const authorReports = [
        {
          id: "report-1",
          authorId: userId,
          coAuthors: [
            { id: "most-active-user", firstName: "Jane", lastName: "Smith" },
          ],
          applicantTeam: { users: [] },
        },
      ];

      const recipientReports = [
        {
          id: "report-2",
          status: ReportStatus.IN_TREATMENT,
          requestedTeams: [{ id: teamId, users: [{ id: "other-member" }] }],
          statusHistory: [],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(authorReports)
        .mockResolvedValueOnce(recipientReports);

      const result = await processTeamRemovalReports(
        mockPrisma,
        userId,
        teamId,
        userName,
        callerUserId,
      );

      expect(result.scenarios).toHaveLength(2);
      expect(result.scenarios[0].type).toBe("AUTHOR_WITH_COAUTHORS");
      expect(result.scenarios[1].type).toBe("RECIPIENT_NOT_HANDLED");
    });
  });

  describe("processTeamDeletionReports", () => {
    const teamId = "team-123";
    const teamName = "Équipe Alpha";
    const callerUserId = "caller-user";

    it("returns empty operations when no reports are affected", async () => {
      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // applicant reports
        .mockResolvedValueOnce([]); // requested reports

      const result = await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      expect(result.operations).toHaveLength(0);
    });

    it("closes all active applicant reports", async () => {
      const applicantReports = [{ id: "report-1" }, { id: "report-2" }];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(applicantReports)
        .mockResolvedValueOnce([]);

      const result = await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      // 2 reports × 3 ops each (update status + history + answer)
      expect(result.operations).toHaveLength(6);

      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-1" },
        data: {
          status: ReportStatus.CLOSED,
          overdueAt: null,
          coAuthors: { set: [] },
        },
      });
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-2" },
        data: {
          status: ReportStatus.CLOSED,
          overdueAt: null,
          coAuthors: { set: [] },
        },
      });

      expect(mockPrisma.reportStatusHistory.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.answer.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.answer.create).toHaveBeenCalledWith({
        data: {
          content: TEAM_DELETION_MESSAGES.APPLICANT_TEAM_CLOSED(teamName),
          reportId: "report-1",
          authorId: callerUserId,
          isMetadataOnly: true,
        },
      });
    });

    it("disconnects team and closes report when sole requested team", async () => {
      const requestedReports = [
        {
          id: "report-3",
          requestedTeams: [{ id: teamId }],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // applicant
        .mockResolvedValueOnce(requestedReports);

      const result = await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      // 1 disconnect + 1 status update + 1 history + 1 answer
      expect(result.operations).toHaveLength(4);

      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-3" },
        data: { requestedTeams: { disconnect: { id: teamId } } },
      });
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-3" },
        data: { status: ReportStatus.CLOSED, overdueAt: null },
      });
      expect(mockPrisma.answer.create).toHaveBeenCalledWith({
        data: {
          content: TEAM_DELETION_MESSAGES.REQUESTED_TEAM_SOLE_CLOSED(teamName),
          reportId: "report-3",
          authorId: callerUserId,
          isMetadataOnly: true,
        },
      });
    });

    it("disconnects team without closing when other requested teams exist", async () => {
      const requestedReports = [
        {
          id: "report-4",
          requestedTeams: [{ id: teamId }, { id: "other-team" }],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // applicant
        .mockResolvedValueOnce(requestedReports);

      const result = await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      // 1 disconnect + 1 answer (no close)
      expect(result.operations).toHaveLength(2);

      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-4" },
        data: { requestedTeams: { disconnect: { id: teamId } } },
      });
      expect(mockPrisma.answer.create).toHaveBeenCalledWith({
        data: {
          content: TEAM_DELETION_MESSAGES.REQUESTED_TEAM_REMOVED(teamName),
          reportId: "report-4",
          authorId: callerUserId,
          isMetadataOnly: true,
        },
      });
      expect(mockPrisma.reportStatusHistory.create).not.toHaveBeenCalled();
    });

    it("handles both applicant and requested reports together", async () => {
      const applicantReports = [{ id: "report-1" }];
      const requestedReports = [
        {
          id: "report-2",
          requestedTeams: [{ id: teamId }],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(applicantReports)
        .mockResolvedValueOnce(requestedReports);

      const result = await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      // applicant: 3 ops (update + history + answer)
      // requested sole: 4 ops (disconnect + update + history + answer)
      expect(result.operations).toHaveLength(7);
    });

    it("clears coAuthors when closing applicant reports", async () => {
      const applicantReports = [{ id: "report-1" }];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(applicantReports)
        .mockResolvedValueOnce([]);

      await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-1" },
        data: {
          status: ReportStatus.CLOSED,
          overdueAt: null,
          coAuthors: { set: [] },
        },
      });
    });

    it("does not clear coAuthors when closing sole requested team report", async () => {
      const requestedReports = [
        {
          id: "report-3",
          requestedTeams: [{ id: teamId }],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(requestedReports);

      await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      // The close update should NOT include coAuthors clearing
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-3" },
        data: { status: ReportStatus.CLOSED, overdueAt: null },
      });
    });

    it("handles multiple requested reports with mixed scenarios", async () => {
      const requestedReports = [
        {
          id: "report-sole",
          requestedTeams: [{ id: teamId }],
        },
        {
          id: "report-multi",
          requestedTeams: [{ id: teamId }, { id: "other-team" }],
        },
      ];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(requestedReports);

      const result = await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      // sole: 4 ops (disconnect + close + history + answer)
      // multi: 2 ops (disconnect + answer)
      expect(result.operations).toHaveLength(6);

      // Both reports should have team disconnected
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-sole" },
        data: { requestedTeams: { disconnect: { id: teamId } } },
      });
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-multi" },
        data: { requestedTeams: { disconnect: { id: teamId } } },
      });

      // Only sole report should be closed
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: "report-sole" },
        data: { status: ReportStatus.CLOSED, overdueAt: null },
      });

      // Status history only for sole report
      expect(mockPrisma.reportStatusHistory.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reportStatusHistory.create).toHaveBeenCalledWith({
        data: {
          reportId: "report-sole",
          status: ReportStatus.CLOSED,
          authorId: callerUserId,
        },
      });

      // Both reports should have answer messages
      expect(mockPrisma.answer.create).toHaveBeenCalledTimes(2);
    });

    it("creates correct status history for applicant reports", async () => {
      const applicantReports = [{ id: "report-1" }];

      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce(applicantReports)
        .mockResolvedValueOnce([]);

      await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      expect(mockPrisma.reportStatusHistory.create).toHaveBeenCalledWith({
        data: {
          reportId: "report-1",
          status: ReportStatus.CLOSED,
          authorId: callerUserId,
        },
      });
    });

    it("queries only active reports", async () => {
      (mockPrisma.report.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await processTeamDeletionReports(
        mockPrisma,
        teamId,
        teamName,
        callerUserId,
      );

      // First call: applicant reports query
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            applicantTeamId: teamId,
            status: {
              in: expect.arrayContaining([
                ReportStatus.PENDING_ASSIGNMENT,
                ReportStatus.IN_TREATMENT,
              ]),
            },
          }),
        }),
      );

      // Second call: requested team reports query
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requestedTeams: { some: { id: teamId } },
            status: {
              in: expect.arrayContaining([
                ReportStatus.PENDING_ASSIGNMENT,
                ReportStatus.IN_TREATMENT,
              ]),
            },
          }),
        }),
      );
    });
  });
});
