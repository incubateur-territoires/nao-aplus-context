import { createCallerFactory } from "../init";
import { answerRouter } from "./answer";
import prisma from "@/lib/prisma";
import {
  ReportStatus,
  NotificationFrequency,
  NotificationType,
} from "@/generated/prisma/enums";
import { createMockUser, MOCK_IDS } from "@/test/mocks";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { checkReportAccess } from "../middleware/authorization";

jest.mock("../middleware/authorization", () => ({
  checkReportAccess: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    answer: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    notificationView: {
      upsert: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    report: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reportStatusHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    file: {
      createMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/app/services/email/email.service", () => ({
  sendTemplatedEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const createCaller = createCallerFactory(answerRouter);

describe("answerRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createAnswer", () => {
    const mockInput = {
      reportId: MOCK_IDS.REPORT_1,
      content: "This is a test answer",
      files: [],
    };

    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.createAnswer(mockInput)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws FORBIDDEN when access is denied", async () => {
      (checkReportAccess as jest.Mock).mockRejectedValueOnce(
        new (jest.requireActual("@trpc/server").TRPCError)({
          code: "FORBIDDEN",
          message: "Vous n'avez pas accès à ce signalement.",
        }),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(caller.createAnswer(mockInput)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("creates an answer successfully", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: {
              update: jest.fn(),
            },
            reportStatusHistory: {
              create: jest.fn(),
            },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.createAnswer(mockInput);

      expect(result).toEqual({
        success: true,
        answerId: MOCK_IDS.ANSWER_1,
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("sends email notifications to report author, co-authors and team users", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      const mockAuthor = {
        email: "answer-author@test.com",
        firstName: "Answer",
        lastName: "Author",
      };

      const mockReport = {
        subject: "Test Report Subject",
        author: {
          id: MOCK_IDS.USER_2,
          email: "report-author@test.com",
          firstName: "Report",
          lastName: "Author",
          notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
        },
        coAuthors: [
          {
            id: MOCK_IDS.USER_3,
            email: "coauthor@test.com",
            firstName: "Co",
            lastName: "Author",
            notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
          },
        ],
        requestedTeams: [
          {
            users: [
              {
                id: "team-user-1",
                email: "team-user@test.com",
                firstName: "Team",
                lastName: "User",
                notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
              },
            ],
          },
        ],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: {
              update: jest.fn(),
            },
            reportStatusHistory: {
              create: jest.fn(),
            },
          };
          return callback(tx);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.createAnswer(mockInput);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.USER_1 },
        select: { email: true, firstName: true, lastName: true },
      });

      expect(prisma.report.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        select: {
          subject: true,
          author: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              notificationFrequency: true,
            },
          },
          coAuthors: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              notificationFrequency: true,
            },
          },
          requestedTeams: {
            select: {
              users: {
                where: { isInactive: null },
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  notificationFrequency: true,
                },
              },
            },
          },
        },
      });

      // Should send to 3 recipients: report author, co-author, team user
      expect(sendTemplatedEmail).toHaveBeenCalledTimes(3);

      // Verify email content for first recipient
      expect(sendTemplatedEmail).toHaveBeenCalledWith(
        "ANSWER_CREATED",
        expect.objectContaining({
          params: expect.objectContaining({
            userFirstName: expect.any(String),
            authorFullName: "Answer Author",
            reportName: "Test Report Subject",
            answerUrl: expect.stringContaining(`#answer-${MOCK_IDS.ANSWER_1}`),
          }),
          replyTo: { email: "answer-author@test.com", name: "Answer Author" },
        }),
      );
    });

    it("excludes the answer author from email recipients", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      const mockAuthor = {
        email: "author@test.com",
        firstName: "Test",
        lastName: "Author",
      };

      // Report author is the same as answer author
      const mockReport = {
        subject: "Test Report",
        author: {
          id: MOCK_IDS.USER_1, // Same as answer author
          email: "author@test.com",
          firstName: "Test",
          lastName: "Author",
          notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
        },
        coAuthors: [
          {
            id: MOCK_IDS.USER_2,
            email: "coauthor@test.com",
            firstName: "Co",
            lastName: "Author",
            notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
          },
        ],
        requestedTeams: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: {
              update: jest.fn(),
            },
            reportStatusHistory: {
              create: jest.fn(),
            },
          };
          return callback(tx);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.createAnswer(mockInput);

      // Should only send to co-author (answer author is excluded)
      expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
      expect(sendTemplatedEmail).toHaveBeenCalledWith(
        "ANSWER_CREATED",
        expect.objectContaining({
          to: [{ email: "coauthor@test.com", name: "Co Author" }],
        }),
      );
    });

    it("deduplicates recipients by email", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      const mockAuthor = {
        email: "author@test.com",
        firstName: "Test",
        lastName: "Author",
      };

      // Same user appears as report author and in team
      const mockReport = {
        subject: "Test Report",
        author: {
          id: MOCK_IDS.USER_2,
          email: "same@test.com",
          firstName: "Same",
          lastName: "User",
          notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
        },
        coAuthors: [],
        requestedTeams: [
          {
            users: [
              {
                id: MOCK_IDS.USER_2, // Same user as report author
                email: "same@test.com",
                firstName: "Same",
                lastName: "User",
                notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
              },
            ],
          },
        ],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: {
              update: jest.fn(),
            },
            reportStatusHistory: {
              create: jest.fn(),
            },
          };
          return callback(tx);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.createAnswer(mockInput);

      // Should only send 1 email (deduplicated)
      expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
    });

    it("does not send emails when isMetadataOnly is true", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: {
              update: jest.fn(),
            },
            reportStatusHistory: {
              create: jest.fn(),
            },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.createAnswer({
        ...mockInput,
        isMetadataOnly: true,
      });

      expect(result).toEqual({
        success: true,
        answerId: MOCK_IDS.ANSWER_1,
      });
      // Should not send any email for metadata-only messages
      expect(sendTemplatedEmail).not.toHaveBeenCalled();
      // Should not fetch report data for email (user.findUnique is still called
      // pour vérifier l'appartenance opérateur de l'auteur)
      expect(prisma.report.findUnique).not.toHaveBeenCalled();
    });

    it("does not send emails when no recipients are found", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      const mockAuthor = {
        email: "author@test.com",
        firstName: "Test",
        lastName: "Author",
      };

      // Answer author is also the report author, no other recipients
      const mockReport = {
        subject: "Test Report",
        author: {
          id: MOCK_IDS.USER_1, // Same as answer author
          email: "author@test.com",
          firstName: "Test",
          lastName: "Author",
          notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
        },
        coAuthors: [],
        requestedTeams: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: {
              update: jest.fn(),
            },
            reportStatusHistory: {
              create: jest.fn(),
            },
          };
          return callback(tx);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.createAnswer(mockInput);

      expect(result).toEqual({
        success: true,
        answerId: MOCK_IDS.ANSWER_1,
      });
      expect(sendTemplatedEmail).not.toHaveBeenCalled();
    });

    it("sends emails only to requested teams users when isOperatorOnly is true", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      const mockAuthor = {
        email: "answer-author@test.com",
        firstName: "Answer",
        lastName: "Author",
      };

      const mockReport = {
        subject: "Test Report",
        author: {
          id: MOCK_IDS.USER_2,
          email: "report-author@test.com",
          firstName: "Report",
          lastName: "Author",
          notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
        },
        coAuthors: [
          {
            id: MOCK_IDS.USER_3,
            email: "coauthor@test.com",
            firstName: "Co",
            lastName: "Author",
            notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
          },
        ],
        requestedTeams: [
          {
            users: [
              {
                id: "team-member-1",
                email: "team-member1@test.com",
                firstName: "Team",
                lastName: "Member1",
                notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
              },
              {
                id: "team-member-2",
                email: "team-member2@test.com",
                firstName: "Team",
                lastName: "Member2",
                notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
              },
            ],
          },
        ],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: {
              update: jest.fn(),
            },
            reportStatusHistory: {
              create: jest.fn(),
            },
          };
          return callback(tx);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.createAnswer({
        ...mockInput,
        isOperatorOnly: true,
      });

      // Should only send to requested teams users (2), not to report author or co-authors
      expect(sendTemplatedEmail).toHaveBeenCalledTimes(2);

      // Verify emails sent only to requested teams users
      expect(sendTemplatedEmail).toHaveBeenCalledWith(
        "ANSWER_CREATED",
        expect.objectContaining({
          to: [{ email: "team-member1@test.com", name: "Team Member1" }],
        }),
      );
      expect(sendTemplatedEmail).toHaveBeenCalledWith(
        "ANSWER_CREATED",
        expect.objectContaining({
          to: [{ email: "team-member2@test.com", name: "Team Member2" }],
        }),
      );

      // Verify report author and co-author were NOT emailed
      expect(sendTemplatedEmail).not.toHaveBeenCalledWith(
        "ANSWER_CREATED",
        expect.objectContaining({
          to: expect.arrayContaining([
            expect.objectContaining({ email: "report-author@test.com" }),
          ]),
        }),
      );
      expect(sendTemplatedEmail).not.toHaveBeenCalledWith(
        "ANSWER_CREATED",
        expect.objectContaining({
          to: expect.arrayContaining([
            expect.objectContaining({ email: "coauthor@test.com" }),
          ]),
        }),
      );
    });

    it("succeeds even when email sending fails", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      const mockAuthor = {
        email: "author@test.com",
        firstName: "Test",
        lastName: "Author",
      };

      const mockReport = {
        subject: "Test Report",
        author: {
          id: MOCK_IDS.USER_2,
          email: "report-author@test.com",
          firstName: "Report",
          lastName: "Author",
          notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
        },
        coAuthors: [],
        requestedTeams: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: {
              update: jest.fn(),
            },
            reportStatusHistory: {
              create: jest.fn(),
            },
          };
          return callback(tx);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);
      (sendTemplatedEmail as jest.Mock).mockRejectedValue(
        new Error("Email failed"),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.createAnswer(mockInput);

      expect(result).toEqual({
        success: true,
        answerId: MOCK_IDS.ANSWER_1,
      });
    });

    it("updates report status when newReportStatus is provided", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      const mockTxReport = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: ReportStatus.PENDING_ASSIGNMENT }),
        update: jest.fn().mockResolvedValue({ authorId: MOCK_IDS.USER_2 }),
      };
      const mockTxReportStatusHistory = {
        create: jest.fn().mockResolvedValue({}),
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: mockTxReport,
            reportStatusHistory: mockTxReportStatusHistory,
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.createAnswer({
        ...mockInput,
        newReportStatus: ReportStatus.IN_TREATMENT,
      });

      expect(result).toEqual({
        success: true,
        answerId: MOCK_IDS.ANSWER_1,
      });

      expect(mockTxReport.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        data: { status: ReportStatus.IN_TREATMENT, overdueAt: null },
      });

      expect(mockTxReportStatusHistory.create).toHaveBeenCalledWith({
        data: {
          reportId: MOCK_IDS.REPORT_1,
          status: ReportStatus.IN_TREATMENT,
          authorId: MOCK_IDS.USER_1,
          answerId: MOCK_IDS.ANSWER_1,
        },
      });
    });

    it("throws CONFLICT when newReportStatus matches the current status", async () => {
      const mockCreatedAnswer = {
        id: MOCK_IDS.ANSWER_1,
      };

      const mockTxReport = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: ReportStatus.CLOSED }),
        update: jest.fn(),
      };
      const mockTxReportStatusHistory = {
        create: jest.fn(),
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: {
              createMany: jest.fn(),
            },
            report: mockTxReport,
            reportStatusHistory: mockTxReportStatusHistory,
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.createAnswer({
          ...mockInput,
          newReportStatus: ReportStatus.CLOSED,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      expect(mockTxReport.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ReportStatus.CLOSED } }),
      );
      expect(mockTxReportStatusHistory.create).not.toHaveBeenCalled();
    });

    it("reopens a closed report to IN_TREATMENT when it had been taken in charge", async () => {
      const mockCreatedAnswer = { id: MOCK_IDS.ANSWER_1 };

      const mockTxReport = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: ReportStatus.CLOSED }),
        update: jest.fn().mockResolvedValue({ authorId: MOCK_IDS.USER_2 }),
      };
      const mockTxReportStatusHistory = {
        findFirst: jest
          .fn()
          .mockResolvedValue({ status: ReportStatus.COMPLETED }),
        create: jest.fn().mockResolvedValue({}),
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: { createMany: jest.fn() },
            report: mockTxReport,
            reportStatusHistory: mockTxReportStatusHistory,
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.createAnswer({ ...mockInput, reopenFromClosed: true });

      expect(mockTxReport.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        data: { status: ReportStatus.IN_TREATMENT, overdueAt: null },
      });
      expect(mockTxReportStatusHistory.create).toHaveBeenCalledWith({
        data: {
          reportId: MOCK_IDS.REPORT_1,
          status: ReportStatus.IN_TREATMENT,
          authorId: MOCK_IDS.USER_1,
          answerId: MOCK_IDS.ANSWER_1,
        },
      });
    });

    it("reopens a closed report to PENDING_ASSIGNMENT when it had never been taken in charge", async () => {
      const mockCreatedAnswer = { id: MOCK_IDS.ANSWER_1 };

      const mockTxReport = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: ReportStatus.CLOSED }),
        update: jest.fn().mockResolvedValue({ authorId: MOCK_IDS.USER_2 }),
      };
      const mockTxReportStatusHistory = {
        findFirst: jest
          .fn()
          .mockResolvedValue({ status: ReportStatus.PENDING_ASSIGNMENT }),
        create: jest.fn().mockResolvedValue({}),
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: { createMany: jest.fn() },
            report: mockTxReport,
            reportStatusHistory: mockTxReportStatusHistory,
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.createAnswer({ ...mockInput, reopenFromClosed: true });

      expect(mockTxReport.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        data: { status: ReportStatus.PENDING_ASSIGNMENT, overdueAt: null },
      });
      expect(mockTxReportStatusHistory.create).toHaveBeenCalledWith({
        data: {
          reportId: MOCK_IDS.REPORT_1,
          status: ReportStatus.PENDING_ASSIGNMENT,
          authorId: MOCK_IDS.USER_1,
          answerId: MOCK_IDS.ANSWER_1,
        },
      });
    });

    it("throws CONFLICT when reopenFromClosed is used on a report that is not closed", async () => {
      const mockCreatedAnswer = { id: MOCK_IDS.ANSWER_1 };

      const mockTxReport = {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: ReportStatus.IN_TREATMENT }),
        update: jest.fn(),
      };
      const mockTxReportStatusHistory = {
        findFirst: jest.fn(),
        create: jest.fn(),
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: { createMany: jest.fn() },
            report: mockTxReport,
            reportStatusHistory: mockTxReportStatusHistory,
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.createAnswer({ ...mockInput, reopenFromClosed: true }),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      expect(mockTxReportStatusHistory.create).not.toHaveBeenCalled();
    });

    it("does not reset overdueAt when no status change is requested", async () => {
      const mockCreatedAnswer = { id: MOCK_IDS.ANSWER_1 };

      const mockTxReport = {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ authorId: MOCK_IDS.USER_2 }),
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            answer: {
              create: jest.fn().mockResolvedValue(mockCreatedAnswer),
              update: jest.fn(),
            },
            file: { createMany: jest.fn() },
            report: mockTxReport,
            reportStatusHistory: { create: jest.fn() },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.createAnswer(mockInput);

      const updateCalls = mockTxReport.update.mock.calls;
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0][0].data).not.toHaveProperty("overdueAt");
      expect(updateCalls[0][0].data).toEqual({
        lastAnswerAt: expect.any(Date),
      });
    });
  });

  describe("markAnswerAsViewed", () => {
    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(
        caller.markAnswerAsViewed({ answerId: MOCK_IDS.ANSWER_1 }),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("upserts answer view record", async () => {
      (prisma.notificationView.upsert as jest.Mock).mockResolvedValue({});

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.markAnswerAsViewed({
        answerId: MOCK_IDS.ANSWER_1,
      });

      expect(result).toEqual({ success: true });
      expect(prisma.notificationView.upsert).toHaveBeenCalledWith({
        where: {
          userId_type_targetId: {
            userId: MOCK_IDS.USER_1,
            type: NotificationType.ANSWER,
            targetId: MOCK_IDS.ANSWER_1,
          },
        },
        update: {},
        create: {
          userId: MOCK_IDS.USER_1,
          type: NotificationType.ANSWER,
          targetId: MOCK_IDS.ANSWER_1,
        },
      });
    });
  });

  describe("markAnswersAsViewed", () => {
    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(
        caller.markAnswersAsViewed({ answerIds: [MOCK_IDS.ANSWER_1] }),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("creates answer view records with skipDuplicates", async () => {
      (prisma.notificationView.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.markAnswersAsViewed({
        answerIds: [MOCK_IDS.ANSWER_1, MOCK_IDS.ANSWER_2],
      });

      expect(result).toEqual({ success: true });
      expect(prisma.notificationView.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: MOCK_IDS.USER_1,
            type: NotificationType.ANSWER,
            targetId: MOCK_IDS.ANSWER_1,
          },
          {
            userId: MOCK_IDS.USER_1,
            type: NotificationType.ANSWER,
            targetId: MOCK_IDS.ANSWER_2,
          },
        ],
        skipDuplicates: true,
      });
    });
  });
});
