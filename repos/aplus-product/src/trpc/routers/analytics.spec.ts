import { createCallerFactory } from "../init";
import { analyticsRouter } from "./analytics";
import prisma from "@/lib/prisma";
import { createMockUser, USER_ROLES } from "@/test/mocks";

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
    analyticsEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    report: {
      count: jest.fn(),
    },
    session: {
      findFirst: jest.fn(),
    },
  },
}));

// Tri partagé par le tableau et « En bref » : occurredAt (heure réelle) puis
// repli sur createdAt.
const LATEST_FIRST = [
  { occurredAt: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
];

const createCaller = createCallerFactory(analyticsRouter);

function createAdminCaller() {
  return createCaller({
    userId: "admin-1",
    user: createMockUser({ role: USER_ROLES.ADMIN }),
  });
}

const actorEvent = {
  id: "evt-1",
  createdAt: new Date("2026-07-01T10:00:00.000Z"),
  occurredAt: new Date("2026-07-01T09:59:00.000Z"),
  eventName: "report_created",
  eventCategory: "report",
  userId: "user-1",
  targetUserId: null,
  sessionId: null,
  pageUrl: null,
  pagePath: "/signalement",
  referrer: null,
  metadata: { reportId: "report-1", numFiles: 2, numTeams: 1 },
  userAgent: "Mozilla",
  ipAddress: "1.2.3.4",
};

const targetEvent = {
  id: "evt-2",
  createdAt: new Date("2026-07-02T10:00:00.000Z"),
  occurredAt: null,
  eventName: "user_deactivated",
  eventCategory: "user",
  userId: "admin-1",
  targetUserId: "user-1",
  sessionId: null,
  pageUrl: null,
  pagePath: null,
  referrer: null,
  metadata: { targetUserId: "user-1" },
  userAgent: null,
  ipAddress: null,
};

describe("analyticsRouter.getUserEvents", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("throws UNAUTHORIZED when user is not logged in", async () => {
    const caller = createCaller({ userId: null, user: null });

    await expect(
      caller.getUserEvents({ userId: "user-1" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN when user is not admin", async () => {
    const caller = createCaller({
      userId: "user-2",
      user: createMockUser({ role: USER_ROLES.USER }),
    });

    await expect(
      caller.getUserEvents({ userId: "user-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("queries actor and target events, excluding page views by default", async () => {
    (prisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.analyticsEvent.count as jest.Mock).mockResolvedValue(0);

    const caller = createAdminCaller();
    await caller.getUserEvents({ userId: "user-1" });

    expect(prisma.analyticsEvent.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: "user-1" }, { targetUserId: "user-1" }],
        eventName: { not: "page_view" },
      },
      orderBy: LATEST_FIRST,
      skip: 0,
      take: 10,
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("includes page views and filters by category when requested", async () => {
    (prisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.analyticsEvent.count as jest.Mock).mockResolvedValue(0);

    const caller = createAdminCaller();
    await caller.getUserEvents({
      userId: "user-1",
      page: 3,
      category: "page_view",
      includePageViews: true,
    });

    expect(prisma.analyticsEvent.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: "user-1" }, { targetUserId: "user-1" }],
        eventCategory: "page_view",
      },
      orderBy: LATEST_FIRST,
      skip: 20,
      take: 10,
    });
  });

  it("resolves actor and target names and flags target events", async () => {
    (prisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([
      targetEvent,
      actorEvent,
    ]);
    (prisma.analyticsEvent.count as jest.Mock).mockResolvedValue(12);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: "user-1",
        firstName: "Bob",
        lastName: "User",
        email: "bob@example.com",
      },
      {
        id: "admin-1",
        firstName: "Alice",
        lastName: "Admin",
        email: "alice@example.com",
      },
    ]);

    const caller = createAdminCaller();
    const result = await caller.getUserEvents({ userId: "user-1" });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["user-1", "admin-1"]) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    expect(result.total).toBe(12);
    expect(result.totalPages).toBe(2);

    const [deactivation, creation] = result.items;
    expect(deactivation).toMatchObject({
      id: "evt-2",
      actorName: "Alice Admin",
      targetName: "Bob User",
      isTarget: true,
    });
    expect(creation).toMatchObject({
      id: "evt-1",
      actorName: "Bob User",
      targetName: null,
      isTarget: false,
    });
  });

  it("falls back to email when the user has no name", async () => {
    (prisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([
      actorEvent,
    ]);
    (prisma.analyticsEvent.count as jest.Mock).mockResolvedValue(1);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: "user-1",
        firstName: null,
        lastName: null,
        email: "bob@example.com",
      },
    ]);

    const caller = createAdminCaller();
    const result = await caller.getUserEvents({ userId: "user-1" });

    expect(result.items[0].actorName).toBe("bob@example.com");
  });

  it("returns null names for deleted or anonymized users", async () => {
    (prisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([
      targetEvent,
    ]);
    (prisma.analyticsEvent.count as jest.Mock).mockResolvedValue(1);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const caller = createAdminCaller();
    const result = await caller.getUserEvents({ userId: "user-1" });

    expect(result.items[0].actorName).toBeNull();
    expect(result.items[0].targetName).toBeNull();
  });
});

describe("analyticsRouter.getUserEventCounts", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("throws FORBIDDEN when user is not admin", async () => {
    const caller = createCaller({
      userId: "user-2",
      user: createMockUser({ role: USER_ROLES.USER }),
    });

    await expect(
      caller.getUserEventCounts({ userId: "user-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("groups event counts by category for actor and target events", async () => {
    (prisma.analyticsEvent.groupBy as jest.Mock).mockResolvedValue([
      { eventCategory: "auth", _count: { _all: 5 } },
      { eventCategory: "report", _count: { _all: 40 } },
      { eventCategory: "page_view", _count: { _all: 210 } },
    ]);

    const caller = createAdminCaller();
    const result = await caller.getUserEventCounts({ userId: "user-1" });

    expect(prisma.analyticsEvent.groupBy).toHaveBeenCalledWith({
      by: ["eventCategory"],
      where: { OR: [{ userId: "user-1" }, { targetUserId: "user-1" }] },
      _count: { _all: true },
    });
    expect(result).toEqual({ auth: 5, report: 40, page_view: 210 });
  });
});

describe("analyticsRouter.getUserActivitySummary", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("throws FORBIDDEN when user is not admin", async () => {
    const caller = createCaller({
      userId: "user-2",
      user: createMockUser({ role: USER_ROLES.USER }),
    });

    await expect(
      caller.getUserActivitySummary({ userId: "user-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  const CHROME_MAC_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  it("derives sign-in from the session (with browser) and account from the user", async () => {
    const session = {
      createdAt: new Date("2026-07-05T08:00:00.000Z"),
      userAgent: CHROME_MAC_UA,
    };
    const deactivation = {
      occurredAt: null,
      createdAt: new Date("2026-07-04T10:00:00.000Z"),
      userId: "admin-1",
    };

    (prisma.session.findFirst as jest.Mock).mockResolvedValue(session);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      lastActivityAt: new Date("2026-07-06T09:00:00.000Z"),
    });
    (prisma.analyticsEvent.findFirst as jest.Mock).mockImplementation(
      ({ where }) =>
        Promise.resolve(
          where.eventName === "user_deactivated" ? deactivation : null,
        ),
    );
    (prisma.report.count as jest.Mock).mockResolvedValue(3);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: "admin-1",
        firstName: "Alice",
        lastName: "Admin",
        email: "alice@example.com",
      },
    ]);

    const caller = createAdminCaller();
    const result = await caller.getUserActivitySummary({ userId: "user-1" });

    expect(prisma.report.count).toHaveBeenCalledWith({
      where: { authorId: "user-1", status: { not: "DELETED" } },
    });
    // Les sessions d'impersonation sont exclues de la « dernière connexion ».
    expect(prisma.session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", impersonatedBy: null },
      }),
    );
    // La session prime sur l'event auth_sign_in et porte le navigateur.
    expect(result.lastSignInAt).toEqual(session.createdAt);
    expect(result.lastSignInBrowser).toBe("Chrome sur macOS");
    expect(result.lastActivityAt).toEqual(new Date("2026-07-06T09:00:00.000Z"));
    expect(result.accountCreatedAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(result.reportsCreatedCount).toBe(3);
    expect(result.lastDeactivation).toEqual({
      at: deactivation.createdAt,
      actorName: "Alice Admin",
    });
    expect(result.lastReactivation).toBeNull();
  });

  it("falls back to the auth_sign_in event when no session exists", async () => {
    const signIn = {
      occurredAt: new Date("2026-07-02T13:00:00.000Z"),
      createdAt: new Date("2026-07-02T13:05:00.000Z"),
    };
    (prisma.session.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.analyticsEvent.findFirst as jest.Mock).mockImplementation(
      ({ where }) =>
        Promise.resolve(where.eventName === "auth_sign_in" ? signIn : null),
    );
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    (prisma.report.count as jest.Mock).mockResolvedValue(2);

    const caller = createAdminCaller();
    const result = await caller.getUserActivitySummary({ userId: "user-1" });

    // Repli sur l'event de connexion (occurredAt), pas sur l'activité.
    expect(result.lastSignInAt).toEqual(signIn.occurredAt);
    expect(result.lastSignInBrowser).toBeNull();
    expect(result.reportsCreatedCount).toBe(2);
  });

  it("returns null last sign-in when no session nor sign-in event exists", async () => {
    // « Dernière connexion » = étape de login uniquement : sans session ni
    // event, on ne fabrique pas une date à partir de l'activité de l'app.
    (prisma.session.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.analyticsEvent.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    (prisma.report.count as jest.Mock).mockResolvedValue(4);

    const caller = createAdminCaller();
    const result = await caller.getUserActivitySummary({ userId: "user-1" });

    expect(result.lastSignInAt).toBeNull();
    expect(result.reportsCreatedCount).toBe(4);
  });
});
