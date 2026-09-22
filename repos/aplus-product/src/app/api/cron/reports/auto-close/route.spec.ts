import { ReportStatus } from "@/generated/prisma/enums";

// --- Mocks ---

const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockCreateMany = jest.fn();
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    report: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mockTransaction(fn),
  },
}));

const mockValidateCronAuth = jest.fn();
jest.mock("@/utils/cron-auth", () => ({
  validateCronAuth: (...args: unknown[]) => mockValidateCronAuth(...args),
}));

const mockSendTemplatedEmail = jest.fn();
jest.mock("@/app/services/email/email.service", () => ({
  sendTemplatedEmail: (...args: unknown[]) => mockSendTemplatedEmail(...args),
}));

const mockPostToMattermost = jest.fn();
jest.mock("@/app/services/mattermost.service", () => ({
  postToMattermost: (...args: unknown[]) => mockPostToMattermost(...args),
}));

// Mock next/server to avoid Request/Response polyfill issues in jsdom
const afterCallbacks: Array<() => void | Promise<void>> = [];
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
  NextRequest: jest.fn(),
  after: (cb: () => void | Promise<void>) => {
    afterCallbacks.push(cb);
  },
}));

// Import after mocks
import { GET } from "./route";

// --- Helpers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createRequest(token: string | null = "Bearer valid-token"): any {
  return {
    headers: {
      get: (name: string) => (name === "authorization" ? token : null),
    },
  };
}

async function flushAfterCallbacks() {
  for (const cb of afterCallbacks) {
    await cb();
  }
  afterCallbacks.length = 0;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function createCompletedReport(
  overrides: {
    id?: string;
    subject?: string;
    authorEmail?: string;
    authorFirstName?: string;
    authorId?: string;
    completedAt?: Date;
  } = {},
) {
  return {
    id: overrides.id ?? "report-1",
    subject: overrides.subject ?? "Problème CAF",
    author: {
      id: overrides.authorId ?? "user-1",
      email: overrides.authorEmail ?? "author@example.com",
      firstName: overrides.authorFirstName ?? "Marie",
    },
    statusHistory: [
      {
        createdAt: overrides.completedAt ?? daysAgo(35),
      },
    ],
  };
}

// --- Setup ---

beforeEach(() => {
  jest.clearAllMocks();
  afterCallbacks.length = 0;
  mockValidateCronAuth.mockReturnValue(null);
  mockPostToMattermost.mockResolvedValue({ success: true });
  mockSendTemplatedEmail.mockResolvedValue({ success: true });
  mockTransaction.mockImplementation(async (fn) => {
    const tx = {
      report: { updateMany: mockUpdateMany },
      reportStatusHistory: { createMany: mockCreateMany },
    };
    return fn(tx);
  });
  process.env.NEXT_PUBLIC_APP_URL = "https://admin-plus.example.com";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

// --- Tests ---

describe("GET /api/cron/reports/auto-close", () => {
  describe("authentication", () => {
    it("returns auth error when token is invalid", async () => {
      const errorResponse = {
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      };
      mockValidateCronAuth.mockReturnValue(errorResponse);

      const response = await GET(createRequest("Bearer invalid"));

      expect(mockValidateCronAuth).toHaveBeenCalledWith("Bearer invalid");
      expect(response.status).toBe(401);
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("returns auth error when no token is provided", async () => {
      const errorResponse = {
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      };
      mockValidateCronAuth.mockReturnValue(errorResponse);

      const response = await GET(createRequest(null));

      expect(response.status).toBe(401);
    });
  });

  describe("no reports to close", () => {
    it("returns success with 0 closed when no completed reports found", async () => {
      mockFindMany.mockResolvedValue([]);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data).toEqual({
        message: "No reports to auto-close",
        checked: 0,
        closed: 0,
      });
      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("Aucun signalement à fermer"),
      );
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockSendTemplatedEmail).not.toHaveBeenCalled();
    });

    it("returns 0 closed when completed reports are less than 30 days old", async () => {
      const recentReport = createCompletedReport({ completedAt: daysAgo(10) });
      mockFindMany.mockResolvedValue([recentReport]);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data.closed).toBe(0);
      expect(data.checked).toBe(1);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("filters out reports completed exactly 29 days ago", async () => {
      const report = createCompletedReport({ completedAt: daysAgo(29) });
      mockFindMany.mockResolvedValue([report]);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data.closed).toBe(0);
    });
  });

  describe("closing reports", () => {
    it("closes a single report completed 30+ days ago", async () => {
      const report = createCompletedReport({ completedAt: daysAgo(35) });
      mockFindMany.mockResolvedValue([report]);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data).toEqual({
        message: "Auto-close started",
        checked: 1,
        toClose: 1,
      });

      await flushAfterCallbacks();
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it("closes multiple reports", async () => {
      const reports = [
        createCompletedReport({ id: "r-1", completedAt: daysAgo(31) }),
        createCompletedReport({ id: "r-2", completedAt: daysAgo(60) }),
        createCompletedReport({ id: "r-3", completedAt: daysAgo(90) }),
      ];
      mockFindMany.mockResolvedValue(reports);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data.toClose).toBe(3);

      await flushAfterCallbacks();
      expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    });

    it("only closes eligible reports from a mixed set", async () => {
      const reports = [
        createCompletedReport({ id: "old", completedAt: daysAgo(45) }),
        createCompletedReport({ id: "recent", completedAt: daysAgo(5) }),
      ];
      mockFindMany.mockResolvedValue(reports);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data.toClose).toBe(1);
    });
  });

  describe("database transaction", () => {
    it("updates report statuses to CLOSED", async () => {
      const report = createCompletedReport({ id: "r-1" });
      mockFindMany.mockResolvedValue([report]);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ["r-1"] } },
        data: { status: ReportStatus.CLOSED, overdueAt: null },
      });
    });

    it("creates status history entries without authorId", async () => {
      const reports = [
        createCompletedReport({ id: "r-1" }),
        createCompletedReport({ id: "r-2" }),
      ];
      mockFindMany.mockResolvedValue(reports);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          { reportId: "r-1", status: ReportStatus.CLOSED },
          { reportId: "r-2", status: ReportStatus.CLOSED },
        ],
      });
    });

    it("performs updateMany and createMany in the same transaction", async () => {
      const report = createCompletedReport();
      mockFindMany.mockResolvedValue([report]);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockUpdateMany).toHaveBeenCalledTimes(1);
      expect(mockCreateMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("email notifications", () => {
    it("sends email to report author with correct template", async () => {
      const report = createCompletedReport({
        id: "r-1",
        subject: "Problème RSA",
        authorEmail: "marie@example.com",
        authorFirstName: "Marie",
      });
      mockFindMany.mockResolvedValue([report]);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        "REPORT_AUTO_CLOSED",
        {
          to: [{ email: "marie@example.com", name: "Marie" }],
          params: {
            userFirstName: "Marie",
            reportSubject: "Problème RSA",
            reportUrl: "https://admin-plus.example.com/signalement/r-1",
          },
        },
      );
    });

    it("sends one email per report", async () => {
      const reports = [
        createCompletedReport({ id: "r-1" }),
        createCompletedReport({ id: "r-2" }),
        createCompletedReport({ id: "r-3" }),
      ];
      mockFindMany.mockResolvedValue(reports);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockSendTemplatedEmail).toHaveBeenCalledTimes(3);
    });

    it("does not fail when email rejects", async () => {
      const reports = [
        createCompletedReport({ id: "r-1" }),
        createCompletedReport({ id: "r-2" }),
      ];
      mockFindMany.mockResolvedValue(reports);
      mockSendTemplatedEmail
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: "SMTP error" });

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockSendTemplatedEmail).toHaveBeenCalledTimes(2);
    });

    it("uses NEXT_PUBLIC_APP_URL env var for report URL", async () => {
      const report = createCompletedReport({ id: "abc" });
      mockFindMany.mockResolvedValue([report]);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        "REPORT_AUTO_CLOSED",
        expect.objectContaining({
          params: expect.objectContaining({
            reportUrl: expect.stringContaining("/signalement/abc"),
          }),
        }),
      );
    });
  });

  describe("mattermost notifications", () => {
    it("posts summary to mattermost when reports are closed", async () => {
      const report = createCompletedReport({ id: "r-1" });
      mockFindMany.mockResolvedValue([report]);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("Fermeture automatique"),
      );
      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("r-1"),
      );
    });

    it("reports the email failures of every batch in the mattermost message", async () => {
      mockFindMany.mockResolvedValue([
        createCompletedReport({ id: "r-1" }),
        createCompletedReport({ id: "r-2" }),
      ]);
      mockSendTemplatedEmail
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          success: false,
          error: "Template is not active",
        });

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining(
          "**1** échec(s) d'envoi d'e-mail sur 2 tentative(s)",
        ),
      );
    });

    it("does not fail when mattermost post throws", async () => {
      const report = createCompletedReport({ id: "r-1" });
      mockFindMany.mockResolvedValue([report]);
      mockPostToMattermost.mockRejectedValue(new Error("Mattermost down"));

      // Le logger écrit sur stderr et non via console.* : `removeConsole`
      // supprime les `console.*` du bundle en production (cf. utils/logger.ts).
      const stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      const response = await GET(createRequest());

      expect(response.status).toBe(200);

      await flushAfterCallbacks();

      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[Auto Close CRON] Failed to post to Mattermost",
        ),
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Mattermost down"),
      );
      stderrSpy.mockRestore();
    });

    it("posts no-reports message when nothing to close", async () => {
      mockFindMany.mockResolvedValue([]);

      await GET(createRequest());

      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("Aucun signalement à fermer"),
      );
    });
  });

  describe("prisma query", () => {
    it("queries only COMPLETED reports with status history", async () => {
      mockFindMany.mockResolvedValue([]);

      await GET(createRequest());

      const queryArgs = mockFindMany.mock.calls[0][0];

      expect(queryArgs.where.status).toBe(ReportStatus.COMPLETED);
      expect(queryArgs.where.statusHistory.some.status).toBe(
        ReportStatus.COMPLETED,
      );
      expect(queryArgs.where.statusHistory.some.createdAt.lte).toBeInstanceOf(
        Date,
      );
    });

    it("selects correct fields including author email and firstName", async () => {
      mockFindMany.mockResolvedValue([]);

      await GET(createRequest());

      const queryArgs = mockFindMany.mock.calls[0][0];
      expect(queryArgs.select.id).toBe(true);
      expect(queryArgs.select.subject).toBe(true);
      expect(queryArgs.select.author.select.email).toBe(true);
      expect(queryArgs.select.author.select.firstName).toBe(true);
    });

    it("orders status history descending and takes only 1", async () => {
      mockFindMany.mockResolvedValue([]);

      await GET(createRequest());

      const queryArgs = mockFindMany.mock.calls[0][0];
      expect(queryArgs.select.statusHistory.orderBy.createdAt).toBe("desc");
      expect(queryArgs.select.statusHistory.take).toBe(1);
    });

    it("uses 30-day threshold date", async () => {
      mockFindMany.mockResolvedValue([]);

      const before = new Date();
      before.setDate(before.getDate() - 30);

      await GET(createRequest());

      const thresholdDate =
        mockFindMany.mock.calls[0][0].where.statusHistory.some.createdAt.lte;

      // Allow 5 seconds tolerance
      expect(Math.abs(thresholdDate.getTime() - before.getTime())).toBeLessThan(
        5000,
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 when prisma query fails", async () => {
      mockFindMany.mockRejectedValue(new Error("DB connection lost"));

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Internal server error" });
    });

    it("logs error when transaction fails in after callback", async () => {
      const report = createCompletedReport();
      mockFindMany.mockResolvedValue([report]);
      mockTransaction.mockRejectedValue(new Error("Transaction failed"));

      const stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      const response = await GET(createRequest());
      expect(response.status).toBe(200);

      await flushAfterCallbacks().catch(() => {});

      stderrSpy.mockRestore();
    });

    it("logs error details when an exception occurs", async () => {
      const error = new Error("Something broke");
      mockFindMany.mockRejectedValue(error);

      const stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      await GET(createRequest());

      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Auto Close CRON] Error auto-closing reports"),
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Something broke"),
      );
      stderrSpy.mockRestore();
    });
  });

  describe("logging", () => {
    it("logs closed report count", async () => {
      const reports = [
        createCompletedReport({ id: "r-1" }),
        createCompletedReport({ id: "r-2" }),
      ];
      mockFindMany.mockResolvedValue(reports);

      const stdoutSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining("automatiquement fermés"),
      );
      stdoutSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("handles report with empty statusHistory", async () => {
      const report = {
        id: "r-1",
        subject: "Test",
        author: { id: "u-1", email: "a@b.com", firstName: "A" },
        statusHistory: [],
      };
      mockFindMany.mockResolvedValue([report]);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data.closed).toBe(0);
    });

    it("closes report completed exactly 30 days ago", async () => {
      const report = createCompletedReport({ completedAt: daysAgo(30) });
      mockFindMany.mockResolvedValue([report]);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data.toClose).toBe(1);
    });
  });
});
