import { createCallerFactory } from "../init";
import { reportRouter } from "./report";
import { prisma } from "@/lib/prisma";
import { ReportStatus, NotificationFrequency } from "@/generated/prisma/enums";
import {
  createMockUser,
  createMockReport,
  MOCK_IDS,
  MOCK_DATES,
  USER_ROLES,
} from "@/test/mocks";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { checkReportAccess } from "../middleware/authorization";

jest.mock("../middleware/authorization", () => ({
  checkCoAuthorsInApplicantTeam: jest.fn(),
  checkReportAccess: jest.fn(),
  checkTeamAccess: jest.fn(),
  checkTeamsInvitableForReport: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    report: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    reportStatusHistory: {
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    answer: {
      findMany: jest.fn(),
    },
    notificationView: {
      findMany: jest.fn(),
    },
    supervisor: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/app/services/email/email.service", () => ({
  sendTemplatedEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const createCaller = createCallerFactory(reportRouter);

describe("reportRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.answer.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.notificationView.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe("getMyCreatedReportsTable", () => {
    beforeEach(() => {
      (prisma.report.count as jest.Mock).mockResolvedValue(2);
    });

    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.getMyCreatedReportsTable()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(prisma.report.findMany).not.toHaveBeenCalled();
    });

    it("returns reports with pagination for non-admin users", async () => {
      const mockReports = [
        createMockReport(),
        createMockReport({
          id: MOCK_IDS.REPORT_2,
          authorId: MOCK_IDS.USER_2,
        }),
      ];

      (prisma.report.findMany as jest.Mock).mockResolvedValue(mockReports);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getMyCreatedReportsTable();

      expect(result.reports).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 10,
        totalCount: 2,
        totalPages: 1,
      });
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.any(Object),
          orderBy: [{ createdAt: "desc" }],
          skip: 0,
          take: 10,
        }),
      );
    });

    it("returns all reports for admin users", async () => {
      const mockReports = [
        createMockReport(),
        createMockReport({ id: MOCK_IDS.REPORT_2 }),
      ];

      (prisma.report.findMany as jest.Mock).mockResolvedValue(mockReports);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.getMyCreatedReportsTable();

      expect(result.reports).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(2);
    });

    it("excludes soft deleted reports", async () => {
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.getMyCreatedReportsTable();

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { status: { not: ReportStatus.DELETED } },
            ]),
          },
        }),
      );
    });
  });

  describe("getMyRequestedReportsTable", () => {
    beforeEach(() => {
      (prisma.report.count as jest.Mock).mockResolvedValue(1);
    });

    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.getMyRequestedReportsTable()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(prisma.report.findMany).not.toHaveBeenCalled();
    });

    it("returns reports with pagination where user is in requestedTeams", async () => {
      const mockReports = [createMockReport()];

      (prisma.report.findMany as jest.Mock).mockResolvedValue(mockReports);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getMyRequestedReportsTable();

      expect(result.reports).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
      });
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.any(Object),
          orderBy: [{ createdAt: "desc" }],
          skip: 0,
          take: 10,
        }),
      );
    });

    it("excludes soft deleted reports", async () => {
      (prisma.report.findMany as jest.Mock).mockResolvedValue([]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.getMyRequestedReportsTable();

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { status: { not: ReportStatus.DELETED } },
            ]),
          },
        }),
      );
    });
  });

  describe("getRecipientsByReportId", () => {
    it("returns requestedTeams for a report", async () => {
      const mockRequestedTeams = [
        {
          name: "Team 1",
          organization: { name: "CAF", shortName: "CAF" },
          users: [{ id: MOCK_IDS.USER_1 }, { id: MOCK_IDS.USER_2 }],
        },
      ];

      (prisma.report.findUnique as jest.Mock).mockResolvedValue({
        requestedTeams: mockRequestedTeams,
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getRecipientsByReportId({
        reportId: MOCK_IDS.REPORT_1,
      });

      expect(result).toEqual([
        {
          name: "Team 1",
          organization: { name: "CAF", shortName: "CAF" },
          users: [
            { id: MOCK_IDS.USER_1, hasViewed: false },
            { id: MOCK_IDS.USER_2, hasViewed: false },
          ],
        },
      ]);
      expect(prisma.report.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        select: {
          requestedTeams: {
            select: {
              name: true,
              organization: { select: { name: true, shortName: true } },
              users: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            where: {
              deletedAt: null,
            },
          },
        },
      });
    });

    it("returns empty array when report is not found", async () => {
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getRecipientsByReportId({
        reportId: "non-existent",
      });

      expect(result).toEqual([]);
    });
  });

  describe("getViewerIdsByReportId", () => {
    it("returns the ids of users who viewed the report", async () => {
      (prisma.notificationView.findMany as jest.Mock).mockResolvedValueOnce([
        { userId: MOCK_IDS.USER_1 },
        { userId: MOCK_IDS.USER_2 },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getViewerIdsByReportId({
        reportId: MOCK_IDS.REPORT_1,
      });

      expect(result).toEqual([MOCK_IDS.USER_1, MOCK_IDS.USER_2]);
      expect(checkReportAccess).toHaveBeenCalledWith(
        expect.objectContaining({ userId: MOCK_IDS.USER_1 }),
        MOCK_IDS.REPORT_1,
      );
      expect(prisma.notificationView.findMany).toHaveBeenCalledWith({
        where: { type: "REPORT", targetId: MOCK_IDS.REPORT_1 },
        select: { userId: true },
      });
    });

    it("returns an empty array when nobody viewed the report", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getViewerIdsByReportId({
        reportId: MOCK_IDS.REPORT_1,
      });

      expect(result).toEqual([]);
    });
  });

  describe("getReportById", () => {
    it("calls checkReportAccess with correct arguments", async () => {
      (prisma.report.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.getReportById(MOCK_IDS.REPORT_1);

      expect(checkReportAccess).toHaveBeenCalledWith(
        expect.objectContaining({ userId: MOCK_IDS.USER_1 }),
        MOCK_IDS.REPORT_1,
      );
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

      await expect(
        caller.getReportById(MOCK_IDS.REPORT_1),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.report.findUnique).not.toHaveBeenCalled();
    });

    it("returns report with all relations", async () => {
      const mockReport = {
        id: MOCK_IDS.REPORT_1,
        files: [],
        area: { id: MOCK_IDS.AREA_1 },
        coAuthors: [],
        requestedTeams: [],
        answers: [],
        statusHistory: [],
        applicantTeam: { organization: {} },
        author: { id: MOCK_IDS.USER_1 },
      };

      (prisma.report.findUnique as jest.Mock).mockResolvedValue(mockReport);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getReportById(MOCK_IDS.REPORT_1);

      expect(result).toEqual(mockReport);
      expect(prisma.report.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        include: {
          files: {
            select: {
              id: true,
              name: true,
            },
          },
          area: true,
          coAuthors: {
            include: {
              teams: {
                select: { id: true, name: true, deletedAt: true },
              },
            },
          },
          requestedTeams: {
            include: {
              organization: {
                include: {
                  specificFields: true,
                },
              },
            },
            where: {
              deletedAt: null,
            },
          },
          answers: { where: {} },
          statusHistory: {
            orderBy: { createdAt: "asc" },
          },
          applicantTeam: {
            include: {
              organization: true,
            },
          },
          author: true,
        },
      });
    });
  });

  describe("createReport", () => {
    beforeEach(() => {
      (prisma.team.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        organizationId: MOCK_IDS.ORG_1,
        type: "FRANCE_SERVICE",
        users: [{ id: MOCK_IDS.USER_1 }, { id: MOCK_IDS.USER_2 }],
      });
    });

    const mockInput = {
      subject: "Test Subject",
      description: "Test Description",
      firstName: "John",
      lastName: "Doe",
      birthDate: "1990-01-01",
      citizenPermissionConfirmed: true,
      caf: "1234567",
      nir: null,
      nif: null,
      phone: "0123456789",
      area: [{ label: "Area 1", value: MOCK_IDS.AREA_1 }],
      applicantTeam: [{ label: "Team 1", value: MOCK_IDS.TEAM_1 }],
      requestedTeams: [
        { label: "Team 2", value: MOCK_IDS.TEAM_2, specificFields: [] },
      ],
      colleagues: [],
      files: [
        {
          id: "file-1",
          name: "test.pdf",
          size: 1000,
          type: "application/pdf",
          lastModified: MOCK_DATES.JAN_1_2024,
        },
      ],
    };

    it("creates a report successfully", async () => {
      const mockCreatedReport = {
        id: MOCK_IDS.REPORT_1,
        authorId: MOCK_IDS.USER_1,
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            report: {
              create: jest.fn().mockResolvedValue(mockCreatedReport),
            },
            reportStatusHistory: {
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.createReport(mockInput);

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.createReport(mockInput)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws FORBIDDEN when the author is not a member of the applicant team", async () => {
      const caller = createCaller({
        userId: "outsider-user",
        user: createMockUser({ id: "outsider-user" }),
      });

      await expect(caller.createReport(mockInput)).rejects.toThrow(
        "Vous devez être membre de l'équipe à l'origine du signalement.",
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws FORBIDDEN when caller is a supervisor", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(caller.createReport(mockInput)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Les superviseurs ne peuvent pas créer de signalements.",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("creates report with coAuthors when provided", async () => {
      const mockCreatedReport = {
        id: MOCK_IDS.REPORT_1,
        authorId: MOCK_IDS.USER_1,
      };
      const inputWithColleagues = {
        ...mockInput,
        colleagues: [{ label: "Jane", value: MOCK_IDS.USER_2 }],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            report: {
              create: jest.fn().mockResolvedValue(mockCreatedReport),
            },
            reportStatusHistory: {
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.createReport(inputWithColleagues);

      expect(result).toEqual({ success: true });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("écarte les co-auteurs qui ne sont pas membres de l'équipe autrice", async () => {
      const mockCreatedReport = {
        id: MOCK_IDS.REPORT_1,
        authorId: MOCK_IDS.USER_1,
      };
      // USER_2 est membre de l'équipe autrice (cf. beforeEach), USER_3 non :
      // il vient d'une équipe choisie puis abandonnée à l'étape 1.
      const inputWithColleagues = {
        ...mockInput,
        colleagues: [
          { label: "Jane", value: MOCK_IDS.USER_2 },
          { label: "Ancien Collègue", value: MOCK_IDS.USER_3 },
        ],
      };

      const reportCreate = jest.fn().mockResolvedValue(mockCreatedReport);
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            report: { create: reportCreate },
            reportStatusHistory: { create: jest.fn().mockResolvedValue({}) },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.createReport(inputWithColleagues);

      expect(reportCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            coAuthors: { connect: [{ id: MOCK_IDS.USER_2 }] },
          }),
        }),
      );
    });

    it("sends email notifications to users in requested teams", async () => {
      const mockCreatedReport = {
        id: MOCK_IDS.REPORT_1,
        authorId: MOCK_IDS.USER_1,
      };

      const mockAuthor = {
        email: "author@test.com",
        firstName: "John",
        lastName: "Author",
      };

      const mockTeamsWithUsers = [
        {
          users: [
            {
              email: "user1@test.com",
              firstName: "User",
              lastName: "One",
              notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
            },
            {
              email: "user2@test.com",
              firstName: "User",
              lastName: "Two",
              notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
            },
          ],
        },
      ];

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            report: {
              create: jest.fn().mockResolvedValue(mockCreatedReport),
            },
            reportStatusHistory: {
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeamsWithUsers);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await caller.createReport(mockInput);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.USER_1 },
        select: { email: true, firstName: true, lastName: true },
      });
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, id: { in: [MOCK_IDS.TEAM_2] } },
        select: {
          users: {
            where: { isInactive: null },
            select: {
              email: true,
              firstName: true,
              lastName: true,
              notificationFrequency: true,
            },
          },
        },
      });
      expect(sendTemplatedEmail).toHaveBeenCalledTimes(2);
    });

    it("does not send emails when no recipients are found", async () => {
      const mockCreatedReport = {
        id: MOCK_IDS.REPORT_1,
        authorId: MOCK_IDS.USER_1,
      };

      const mockAuthor = {
        email: "author@test.com",
        firstName: "John",
        lastName: "Author",
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            report: {
              create: jest.fn().mockResolvedValue(mockCreatedReport),
            },
            reportStatusHistory: {
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
      (prisma.team.findMany as jest.Mock).mockResolvedValue([{ users: [] }]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.createReport(mockInput);

      expect(result).toEqual({ success: true });
      expect(sendTemplatedEmail).not.toHaveBeenCalled();
    });

    it("succeeds even when email sending fails", async () => {
      const mockCreatedReport = {
        id: MOCK_IDS.REPORT_1,
        authorId: MOCK_IDS.USER_1,
      };

      const mockAuthor = {
        email: "author@test.com",
        firstName: "John",
        lastName: "Author",
      };

      const mockTeamsWithUsers = [
        {
          users: [
            {
              email: "user1@test.com",
              firstName: "User",
              lastName: "One",
              notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
            },
          ],
        },
      ];

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            report: {
              create: jest.fn().mockResolvedValue(mockCreatedReport),
            },
            reportStatusHistory: {
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAuthor);
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeamsWithUsers);
      (sendTemplatedEmail as jest.Mock).mockRejectedValue(
        new Error("Email failed"),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.createReport(mockInput);

      expect(result).toEqual({ success: true });
    });
  });

  describe("updateReportStatus", () => {
    it("rejects the DELETED status, reserved to the anonymization service", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.updateReportStatus({
          id: MOCK_IDS.REPORT_1,
          status: "DELETED" as never,
        }),
      ).rejects.toThrow(
        "Ce statut ne peut pas être appliqué à un signalement.",
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
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

      await expect(
        caller.updateReportStatus({
          id: MOCK_IDS.REPORT_1,
          status: ReportStatus.IN_TREATMENT,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("updates report status and creates status history", async () => {
      const mockUpdatedReport = { authorId: MOCK_IDS.USER_1 };
      const txReportUpdate = jest.fn().mockResolvedValue(mockUpdatedReport);
      const txHistoryCreate = jest.fn().mockResolvedValue({});

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            report: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ status: ReportStatus.PENDING_ASSIGNMENT }),
              update: txReportUpdate,
            },
            reportStatusHistory: {
              create: txHistoryCreate,
            },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.updateReportStatus({
        id: MOCK_IDS.REPORT_1,
        status: ReportStatus.IN_TREATMENT,
      });

      expect(result).toEqual({
        success: true,
        status: ReportStatus.IN_TREATMENT,
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txReportUpdate).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        data: { status: ReportStatus.IN_TREATMENT, overdueAt: null },
      });
      expect(txHistoryCreate).toHaveBeenCalled();
    });

    it("restores the actual pre-closure status from history when reopening", async () => {
      // Le signalement était PENDING_ASSIGNMENT à la fermeture (ex. un simple
      // message a créé une réponse sans prise en charge). La réouverture doit
      // restaurer PENDING_ASSIGNMENT, pas deviner IN_TREATMENT.
      const txReportUpdate = jest.fn().mockResolvedValue({});
      const txHistoryCreate = jest.fn().mockResolvedValue({});
      const txHistoryFindFirst = jest
        .fn()
        .mockResolvedValue({ status: ReportStatus.PENDING_ASSIGNMENT });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            report: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ status: ReportStatus.CLOSED }),
              update: txReportUpdate,
            },
            reportStatusHistory: {
              findFirst: txHistoryFindFirst,
              create: txHistoryCreate,
            },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      // Le client envoie IN_TREATMENT (ancienne heuristique) : le serveur doit
      // l'ignorer et restaurer le statut réel issu de l'historique.
      const result = await caller.updateReportStatus({
        id: MOCK_IDS.REPORT_1,
        status: ReportStatus.IN_TREATMENT,
      });

      expect(result).toEqual({
        success: true,
        status: ReportStatus.PENDING_ASSIGNMENT,
      });
      expect(txHistoryFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportId: MOCK_IDS.REPORT_1,
            status: {
              notIn: [ReportStatus.CLOSED, ReportStatus.DELETED],
            },
          }),
          orderBy: { createdAt: "desc" },
        }),
      );
      expect(txReportUpdate).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        data: { status: ReportStatus.PENDING_ASSIGNMENT, overdueAt: null },
      });
      expect(txHistoryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: ReportStatus.PENDING_ASSIGNMENT,
        }),
      });
    });

    it("throws CONFLICT when status is already the requested one", async () => {
      const txReportUpdate = jest.fn();
      const txHistoryCreate = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            report: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ status: ReportStatus.CLOSED }),
              update: txReportUpdate,
            },
            reportStatusHistory: {
              create: txHistoryCreate,
            },
          };
          return callback(tx);
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.updateReportStatus({
          id: MOCK_IDS.REPORT_1,
          status: ReportStatus.CLOSED,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      expect(txReportUpdate).not.toHaveBeenCalled();
      expect(txHistoryCreate).not.toHaveBeenCalled();
    });
  });

  describe("addRequestedTeamsToReport", () => {
    it("adds requested teams to report after checking their eligibility", async () => {
      (prisma.report.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        areaId: MOCK_IDS.AREA_1,
        applicantTeam: { type: "FRANCE_SERVICE" },
      });
      (prisma.report.update as jest.Mock).mockResolvedValue({});

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.addRequestedTeamsToReport({
        reportId: MOCK_IDS.REPORT_1,
        teamIds: [MOCK_IDS.TEAM_1, MOCK_IDS.TEAM_2],
      });

      expect(result).toEqual({ success: true });
      const { checkTeamsInvitableForReport } = jest.requireMock(
        "../middleware/authorization",
      );
      expect(checkTeamsInvitableForReport).toHaveBeenCalledWith(
        { areaId: MOCK_IDS.AREA_1, applicantTeamType: "FRANCE_SERVICE" },
        [MOCK_IDS.TEAM_1, MOCK_IDS.TEAM_2],
      );
      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        data: {
          requestedTeams: {
            connect: [{ id: MOCK_IDS.TEAM_1 }, { id: MOCK_IDS.TEAM_2 }],
          },
        },
      });
    });

    it("propagates the refusal when a team is not invitable", async () => {
      (prisma.report.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        areaId: MOCK_IDS.AREA_1,
        applicantTeam: { type: "FRANCE_SERVICE" },
      });
      const { checkTeamsInvitableForReport } = jest.requireMock(
        "../middleware/authorization",
      );
      (checkTeamsInvitableForReport as jest.Mock).mockRejectedValueOnce(
        new Error(
          "Une ou plusieurs équipes ne peuvent pas être destinataires de ce signalement.",
        ),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.addRequestedTeamsToReport({
          reportId: MOCK_IDS.REPORT_1,
          teamIds: [MOCK_IDS.TEAM_2],
        }),
      ).rejects.toThrow(
        "Une ou plusieurs équipes ne peuvent pas être destinataires de ce signalement.",
      );
      expect(prisma.report.update).not.toHaveBeenCalled();
    });
  });

  describe("addCoAuthorsToReport", () => {
    it("adds coAuthors to report after checking applicant team membership", async () => {
      (prisma.report.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        applicantTeamId: MOCK_IDS.TEAM_1,
      });
      (prisma.report.update as jest.Mock).mockResolvedValue({});

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.addCoAuthorsToReport({
        reportId: MOCK_IDS.REPORT_1,
        coAuthorIds: [MOCK_IDS.USER_2],
      });

      expect(result).toEqual({ success: true });
      const { checkCoAuthorsInApplicantTeam } = jest.requireMock(
        "../middleware/authorization",
      );
      expect(checkCoAuthorsInApplicantTeam).toHaveBeenCalledWith(
        MOCK_IDS.TEAM_1,
        [MOCK_IDS.USER_2],
      );
      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.REPORT_1 },
        data: {
          coAuthors: { connect: [{ id: MOCK_IDS.USER_2 }] },
        },
      });
    });

    it("propagates the refusal when a coAuthor is not in the applicant team", async () => {
      (prisma.report.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        applicantTeamId: MOCK_IDS.TEAM_1,
      });
      const { checkCoAuthorsInApplicantTeam } = jest.requireMock(
        "../middleware/authorization",
      );
      (checkCoAuthorsInApplicantTeam as jest.Mock).mockRejectedValueOnce(
        new Error(
          "Un co-auteur doit être membre de l'équipe à l'origine du signalement.",
        ),
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      await expect(
        caller.addCoAuthorsToReport({
          reportId: MOCK_IDS.REPORT_1,
          coAuthorIds: [MOCK_IDS.USER_2],
        }),
      ).rejects.toThrow(
        "Un co-auteur doit être membre de l'équipe à l'origine du signalement.",
      );
      expect(prisma.report.update).not.toHaveBeenCalled();
    });
  });

  describe("exportCsv", () => {
    const exportInput = {
      areaIds: [MOCK_IDS.AREA_1],
      startDate: undefined,
      endDate: undefined,
    };

    const mockExportReports = [
      {
        id: MOCK_IDS.REPORT_1,
        createdAt: MOCK_DATES.JAN_1_2024,
        status: ReportStatus.IN_TREATMENT,
        area: { name: "Aisne" },
        author: { firstName: "Jean", lastName: "DUPONT" },
        coAuthors: [],
        applicantTeam: { name: "FS Laon", organization: { shortName: "FS" } },
        requestedTeams: [{ name: "CPAM", _count: { users: 2 } }],
        _count: { answers: 1 },
        answers: [{ isIrrelevant: false, createdAt: MOCK_DATES.JAN_2_2024 }],
        statusHistory: [
          {
            status: ReportStatus.PENDING_ASSIGNMENT,
            createdAt: MOCK_DATES.JAN_1_2024,
          },
        ],
      },
    ];

    function mockExportSuccess() {
      (prisma.report.findMany as jest.Mock).mockResolvedValue(
        mockExportReports,
      );
      (prisma.report.count as jest.Mock).mockResolvedValue(1);
    }

    it("allows admin to export all requested areas", async () => {
      // Admin: team.findMany pour manager check retourne vide (pas besoin d'être manager)
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      mockExportSuccess();

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.exportCsv(exportInput);

      expect(result.reports).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.limit).toBe(5000);
    });

    it("allows supervisor to export within their scope", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      });
      mockExportSuccess();

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.exportCsv(exportInput);

      expect(result.reports).toHaveLength(1);
    });

    it("restricts supervisor export to their organizations, like checkReportAccess", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: MOCK_IDS.AREA_1 }],
        organizations: [{ id: MOCK_IDS.ORG_1 }],
      });
      mockExportSuccess();

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await caller.exportCsv(exportInput);

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                areaId: { in: [MOCK_IDS.AREA_1] },
                OR: [
                  {
                    applicantTeam: {
                      organizationId: { in: [MOCK_IDS.ORG_1] },
                    },
                  },
                  {
                    requestedTeams: {
                      some: { organizationId: { in: [MOCK_IDS.ORG_1] } },
                    },
                  },
                ],
              },
              { authorId: MOCK_IDS.USER_1 },
              { coAuthors: { some: { id: MOCK_IDS.USER_1 } } },
            ],
          }),
        }),
      );
    });

    it("throws FORBIDDEN for supervisor with no scope", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(caller.exportCsv(exportInput)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Aucun périmètre de supervision trouvé.",
      });
    });

    it("throws FORBIDDEN for supervisor requesting areas outside scope", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: [{ id: MOCK_IDS.AREA_2 }],
        organizations: [],
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      await expect(caller.exportCsv(exportInput)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message:
          "Aucun des territoires sélectionnés ne fait partie de votre périmètre.",
      });
    });

    it("allows manager to export within their team areas", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { id: MOCK_IDS.TEAM_1, areas: [{ id: MOCK_IDS.AREA_1 }] },
      ]);
      mockExportSuccess();

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.exportCsv(exportInput);

      expect(result.reports).toHaveLength(1);
    });

    it("manager export includes managed teams, authored, and member reports", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { id: MOCK_IDS.TEAM_1, areas: [{ id: MOCK_IDS.AREA_1 }] },
      ]);
      mockExportSuccess();

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await caller.exportCsv(exportInput);

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                areaId: { in: [MOCK_IDS.AREA_1] },
                applicantTeamId: { in: [MOCK_IDS.TEAM_1] },
              },
              {
                areaId: { in: [MOCK_IDS.AREA_1] },
                requestedTeams: {
                  some: { id: { in: [MOCK_IDS.TEAM_1] } },
                },
              },
              { authorId: MOCK_IDS.USER_1 },
              { coAuthors: { some: { id: MOCK_IDS.USER_1 } } },
              {
                areaId: { in: [MOCK_IDS.AREA_1] },
                requestedTeams: {
                  some: { users: { some: { id: MOCK_IDS.USER_1 } } },
                },
              },
            ],
          }),
        }),
      );
    });

    it("throws FORBIDDEN for manager requesting areas outside their teams", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { id: MOCK_IDS.TEAM_1, areas: [{ id: MOCK_IDS.AREA_2 }] },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(caller.exportCsv(exportInput)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message:
          "Aucun des territoires sélectionnés ne fait partie de vos équipes.",
      });
    });

    it("throws FORBIDDEN for regular user who is not a manager", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(caller.exportCsv(exportInput)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("applies date filters when provided", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      mockExportSuccess();

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.exportCsv({
        areaIds: [MOCK_IDS.AREA_1],
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date("2024-01-01T00:00:00.000Z"),
              lte: new Date("2024-12-31T23:59:59.999Z"),
            },
          }),
        }),
      );
    });
  });

  describe("getColleagues", () => {
    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.getColleagues(MOCK_IDS.TEAM_1)).rejects.toMatchObject(
        {
          code: "UNAUTHORIZED",
        },
      );
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("returns users from the same team excluding the current user", async () => {
      const mockColleagues = [
        { id: MOCK_IDS.USER_2, firstName: "Jane", lastName: "Doe" },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockColleagues);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ id: MOCK_IDS.USER_1 }),
      });

      const result = await caller.getColleagues(MOCK_IDS.TEAM_1);

      expect(result).toEqual(mockColleagues);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          teams: {
            some: {
              id: MOCK_IDS.TEAM_1,
            },
          },
          id: { not: MOCK_IDS.USER_1 },
          isInactive: null,
          deletedAt: null,
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
    });

    it("throws UNAUTHORIZED when user is missing", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: null,
      });

      await expect(caller.getColleagues(MOCK_IDS.TEAM_1)).rejects.toMatchObject(
        {
          code: "UNAUTHORIZED",
        },
      );
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
