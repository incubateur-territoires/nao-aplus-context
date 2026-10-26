import { createCallerFactory } from "../init";
import { taggingStatsRouter } from "./tagging-stats";
import prisma from "@/lib/prisma";
import { createMockUser, MOCK_IDS, USER_ROLES } from "@/test/mocks";

jest.mock("@/lib/auth", () => ({
  auth: { api: { getSession: jest.fn() } },
}));

jest.mock("@/lib/prisma", () => {
  const mock = {
    reportTagging: { findMany: jest.fn() },
    user: { count: jest.fn() },
  };
  return { __esModule: true, default: mock, prisma: mock };
});

const createCaller = createCallerFactory(taggingStatsRouter);

function callerWithRole(role: (typeof USER_ROLES)[keyof typeof USER_ROLES]) {
  return createCaller({
    userId: MOCK_IDS.USER_1,
    user: createMockUser({ id: MOCK_IDS.USER_1, role }),
  });
}

describe("taggingStatsRouter.get", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([USER_ROLES.USER, USER_ROLES.SUPERVISOR])(
    "throws FORBIDDEN for a %s",
    async (role) => {
      await expect(callerWithRole(role).get()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prisma.reportTagging.findMany).not.toHaveBeenCalled();
      expect(prisma.user.count).not.toHaveBeenCalled();
    },
  );

  it("feeds taggings and hidden users into the stats", async () => {
    (prisma.reportTagging.findMany as jest.Mock).mockResolvedValue([
      {
        reportId: "report-1",
        createdAt: new Date("2026-10-01T09:00:00.000Z"),
        procedureLabel: "demande rsa",
        blockageLabel: "aucun",
        verdicts: [
          {
            userId: MOCK_IDS.USER_2,
            createdAt: new Date("2026-10-02T09:00:00.000Z"),
            procedureIsCorrect: false,
            blockageIsCorrect: null,
          },
        ],
      },
    ]);
    (prisma.user.count as jest.Mock).mockResolvedValue(4);

    const stats = await callerWithRole(USER_ROLES.ADMIN).get();

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { taggingFeedbackHiddenAt: { not: null } },
    });
    expect(stats).toMatchObject({
      taggedReports: 1,
      voters: 1,
      votes: 1,
      hiddenFeedbackUsers: 4,
    });
    expect(stats.axes.procedure.labels).toEqual([
      {
        label: "demande rsa",
        reports: 1,
        upvotes: 0,
        downvotes: 1,
        approvalRate: 0,
      },
    ]);
  });
});
