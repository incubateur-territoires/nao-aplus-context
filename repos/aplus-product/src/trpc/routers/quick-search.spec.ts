import { createCallerFactory } from "../init";
import { quickSearchRouter } from "./quick-search";
import prisma from "@/lib/prisma";
import { searchTeamsWithUnaccent, searchWithUnaccent } from "@/utils/search";
import { createMockUser, USER_ROLES } from "@/test/mocks";

jest.mock("@/lib/auth", () => ({
  auth: { api: { getSession: jest.fn() } },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    report: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn() },
    team: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock("@/utils/search", () => ({
  searchWithUnaccent: jest.fn(),
  searchTeamsWithUnaccent: jest.fn(),
}));

const createCaller = createCallerFactory(quickSearchRouter);

const REPORT_ID = "3f2b8c1e-9a4d-4e2f-8b7a-1c5d6e7f8a9b";

const report = {
  id: REPORT_ID,
  subject: "Blocage APL",
  status: "IN_TREATMENT",
  createdAt: new Date("2026-10-01T10:00:00Z"),
  author: { firstName: "Alice", lastName: "Martin" },
};
const user = {
  id: "user-42",
  firstName: "Alice",
  lastName: "Martin",
  email: "alice@example.org",
  role: "user",
};
const team = {
  id: "team-7",
  name: "France Services Alpha",
  organization: { shortName: "FS" },
};

function adminCaller() {
  return createCaller({
    userId: "admin-1",
    user: createMockUser({ id: "admin-1", role: USER_ROLES.ADMIN }),
  });
}

describe("quickSearchRouter.search", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("refuses non-admin users", async () => {
    const caller = createCaller({
      userId: "user-1",
      user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
    });

    await expect(caller.search({ query: "martin" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects queries shorter than two characters", async () => {
    await expect(adminCaller().search({ query: " a " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("opens an entity directly from a pasted URL", async () => {
    (prisma.report.findFirst as jest.Mock).mockResolvedValue(report);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await adminCaller().search({
      query: `https://example.org/signalement/${REPORT_ID}`,
    });

    expect(result).toEqual({ reports: [report], users: [], teams: [] });
    expect(searchWithUnaccent).not.toHaveBeenCalled();
  });

  it("searches reports by subject and author, never by citizen name", async () => {
    (searchWithUnaccent as jest.Mock).mockImplementation((table: string) =>
      Promise.resolve(table === "Report" ? [REPORT_ID] : ["user-42"]),
    );
    (searchTeamsWithUnaccent as jest.Mock).mockResolvedValue({
      ids: ["team-7"],
      total: 1,
    });
    (prisma.report.findMany as jest.Mock).mockResolvedValue([report]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);
    (prisma.team.findMany as jest.Mock).mockResolvedValue([team]);

    const result = await adminCaller().search({ query: "martin" });

    expect(result).toEqual({
      reports: [report],
      users: [user],
      teams: [team],
    });
    expect(searchWithUnaccent).toHaveBeenCalledWith(
      "Report",
      ["subject"],
      "martin",
    );
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { not: "DELETED" },
          OR: [{ id: { in: [REPORT_ID] } }, { authorId: { in: ["user-42"] } }],
        },
      }),
    );
  });
});
