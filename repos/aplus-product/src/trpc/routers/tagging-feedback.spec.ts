import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "../init";
import { checkReportAccess } from "../middleware/authorization";
import { taggingFeedbackRouter } from "./tagging-feedback";
import prisma from "@/lib/prisma";
import { createMockUser, MOCK_IDS, USER_ROLES } from "@/test/mocks";

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

jest.mock("@/lib/prisma", () => {
  const mock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reportTagging: {
      findFirst: jest.fn(),
    },
    reportTaggingVerdict: {
      upsert: jest.fn(),
    },
  };
  return { __esModule: true, default: mock, prisma: mock };
});

const createCaller = createCallerFactory(taggingFeedbackRouter);

const RECIPIENT_FILTER = {
  requestedTeams: { some: { users: { some: { id: MOCK_IDS.USER_1 } } } },
};

function userCaller() {
  return createCaller({
    userId: MOCK_IDS.USER_1,
    user: createMockUser({ id: MOCK_IDS.USER_1, role: USER_ROLES.USER }),
  });
}

const REPORT_ID = "report-1";
const TAGGING_ID = "tagging-1";

describe("taggingFeedbackRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      taggingFeedbackHiddenAt: null,
    });
  });

  describe("get", () => {
    it("rejects a user who cannot access the report", async () => {
      (checkReportAccess as jest.Mock).mockRejectedValueOnce(
        new TRPCError({ code: "FORBIDDEN" }),
      );

      await expect(
        userCaller().get({ reportId: REPORT_ID }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prisma.reportTagging.findFirst).not.toHaveBeenCalled();
    });

    it("returns null once the user hid the block for good", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        taggingFeedbackHiddenAt: new Date(),
      });

      await expect(userCaller().get({ reportId: REPORT_ID })).resolves.toBe(
        null,
      );
      expect(prisma.reportTagging.findFirst).not.toHaveBeenCalled();
    });

    it("returns null when the report has no tagging", async () => {
      (prisma.reportTagging.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(userCaller().get({ reportId: REPORT_ID })).resolves.toBe(
        null,
      );
    });

    it("returns null when no axis can be evaluated", async () => {
      (prisma.reportTagging.findFirst as jest.Mock).mockResolvedValue({
        id: TAGGING_ID,
        procedureLabel: "inconnu",
        blockageLabel: "aucun",
        verdicts: [],
      });

      await expect(userCaller().get({ reportId: REPORT_ID })).resolves.toBe(
        null,
      );
    });

    it("returns the latest tagging with the current user's verdicts", async () => {
      (prisma.reportTagging.findFirst as jest.Mock).mockResolvedValue({
        id: TAGGING_ID,
        procedureLabel: "demande rsa",
        blockageLabel: "déménagement",
        verdicts: [{ procedureIsCorrect: true, blockageIsCorrect: null }],
      });

      await expect(userCaller().get({ reportId: REPORT_ID })).resolves.toEqual({
        taggingId: TAGGING_ID,
        axes: [
          {
            axis: "procedure",
            label: "demande rsa",
            isCorrect: true,
          },
          {
            axis: "blockage",
            label: "déménagement",
            isCorrect: null,
          },
        ],
      });
      expect(prisma.reportTagging.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reportId: REPORT_ID, report: RECIPIENT_FILTER },
          orderBy: { createdAt: "desc" },
          select: expect.objectContaining({
            verdicts: {
              where: { userId: MOCK_IDS.USER_1 },
              select: { procedureIsCorrect: true, blockageIsCorrect: true },
            },
          }),
        }),
      );
    });
  });

  describe("setVerdict", () => {
    const input = {
      taggingId: TAGGING_ID,
      axis: "blockage" as const,
      isCorrect: false,
    };

    it("throws NOT_FOUND for a tagging the user is not a recipient of", async () => {
      (prisma.reportTagging.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(userCaller().setVerdict(input)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(prisma.reportTaggingVerdict.upsert).not.toHaveBeenCalled();
    });

    it("checks access on the tagging's report before writing", async () => {
      (prisma.reportTagging.findFirst as jest.Mock).mockResolvedValue({
        reportId: REPORT_ID,
      });
      (checkReportAccess as jest.Mock).mockRejectedValueOnce(
        new TRPCError({ code: "FORBIDDEN" }),
      );

      await expect(userCaller().setVerdict(input)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(checkReportAccess).toHaveBeenCalledWith(
        expect.objectContaining({ userId: MOCK_IDS.USER_1 }),
        REPORT_ID,
      );
      expect(prisma.reportTaggingVerdict.upsert).not.toHaveBeenCalled();
    });

    it("upserts the verdict on the tagging, user and axis key", async () => {
      (prisma.reportTagging.findFirst as jest.Mock).mockResolvedValue({
        reportId: REPORT_ID,
      });

      await userCaller().setVerdict(input);

      expect(prisma.reportTagging.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TAGGING_ID, report: RECIPIENT_FILTER },
        }),
      );

      expect(prisma.reportTaggingVerdict.upsert).toHaveBeenCalledWith({
        where: {
          taggingId_userId: { taggingId: TAGGING_ID, userId: MOCK_IDS.USER_1 },
        },
        create: {
          taggingId: TAGGING_ID,
          userId: MOCK_IDS.USER_1,
          blockageIsCorrect: false,
        },
        update: { blockageIsCorrect: false },
      });
    });

    it("rejects an unknown axis", async () => {
      await expect(
        userCaller().setVerdict({
          ...input,
          axis: "organization" as "blockage",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("hide", () => {
    it("stamps the current user only", async () => {
      await userCaller().hide();

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.USER_1 },
        data: { taggingFeedbackHiddenAt: expect.any(Date) },
      });
    });
  });
});
