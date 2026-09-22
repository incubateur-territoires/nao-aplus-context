import { OrganizationRole, ReportStatus } from "@/generated/prisma/enums";

// --- Mocks ---

const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    report: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
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

function createOverdueReport(
  overrides: { id?: string; subject?: string } = {},
) {
  return {
    id: overrides.id ?? "report-1",
    subject: overrides.subject ?? "Problème CAF",
    author: {
      email: "author@example.com",
      firstName: "Marie",
      lastName: "Durand",
      isInactive: null,
    },
    coAuthors: [],
  };
}

// --- Setup ---

beforeEach(() => {
  jest.clearAllMocks();
  afterCallbacks.length = 0;
  mockValidateCronAuth.mockReturnValue(null);
  mockPostToMattermost.mockResolvedValue({ success: true });
  mockSendTemplatedEmail.mockResolvedValue({ success: true });
  mockUpdateMany.mockResolvedValue({ count: 0 });
  process.env.NEXT_PUBLIC_APP_URL = "https://admin-plus.example.com";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

// --- Tests ---

describe("GET /api/cron/reports/overdue", () => {
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
  });

  describe("no reports to update", () => {
    it("returns 0 updated when no overdue reports are found", async () => {
      mockFindMany.mockResolvedValue([]);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data).toEqual({
        message: "No reports to update",
        checked: 0,
        updated: 0,
      });
      expect(mockUpdateMany).not.toHaveBeenCalled();
      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("pas de signalements en souffrance"),
      );
    });
  });

  describe("marking reports overdue", () => {
    it("sets overdueAt on the reports returned by the queries", async () => {
      // Case 1 renvoie un signalement, Case 2 aucun.
      mockFindMany
        .mockResolvedValueOnce([createOverdueReport({ id: "r-1" })])
        .mockResolvedValueOnce([]);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data.updated).toBe(1);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ["r-1"] } },
        data: { overdueAt: expect.any(Date) },
      });
    });

    it("dedupes a report returned by both cases", async () => {
      const shared = createOverdueReport({ id: "dup" });
      mockFindMany
        .mockResolvedValueOnce([shared])
        .mockResolvedValueOnce([shared]);

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data.updated).toBe(1);
      expect(data.reportIds).toEqual(["dup"]);
    });
  });

  describe("prisma query shape", () => {
    it("Case 1 filters active reports with no operator answer, older than the business-day cutoff", async () => {
      mockFindMany.mockResolvedValue([]);

      await GET(createRequest());

      const case1Where = mockFindMany.mock.calls[0][0].where;
      expect(case1Where.status.in).toEqual([
        ReportStatus.PENDING_ASSIGNMENT,
        ReportStatus.IN_TREATMENT,
      ]);
      expect(case1Where.overdueAt).toBeNull();
      expect(case1Where.createdAt.lt).toBeInstanceOf(Date);
      expect(case1Where.answers.none.author.teams.some.role).toBe(
        OrganizationRole.OPERATOR,
      );
    });

    it("Case 2 still requires an operator answer with no recent operator answer", async () => {
      mockFindMany.mockResolvedValue([]);

      await GET(createRequest());

      const case2Where = mockFindMany.mock.calls[1][0].where;
      expect(case2Where.answers.some.author.teams.some.role).toBe(
        OrganizationRole.OPERATOR,
      );
      expect(case2Where.answers.none.author.teams.some.role).toBe(
        OrganizationRole.OPERATOR,
      );
      expect(case2Where.answers.none.createdAt.gte).toBeInstanceOf(Date);
    });
  });

  describe("réinitialisation du compteur au repassage en cours de traitement", () => {
    it("Case 2 exclut tout signalement ayant eu une activité (réponse) dans les 15 derniers jours", async () => {
      mockFindMany.mockResolvedValue([]);

      await GET(createRequest());

      // Le repassage en cours de traitement crée une réponse et bumpe `lastAnswerAt`.
      // Ce garde-fou empêche donc le cron de re-flaguer immédiatement le signalement :
      // il ne repassera "en souffrance" que 15 jours après la date de repassage.
      const case2Where = mockFindMany.mock.calls[1][0].where;
      expect(case2Where.NOT).toEqual({
        lastAnswerAt: { gte: expect.any(Date) },
      });
    });

    it("utilise un seuil de 15 jours calendaires pour le garde-fou d'activité", async () => {
      mockFindMany.mockResolvedValue([]);

      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 15);
      expectedCutoff.setHours(0, 0, 0, 0);

      await GET(createRequest());

      const cutoff = mockFindMany.mock.calls[1][0].where.NOT.lastAnswerAt.gte;
      // Tolérance de 5 secondes pour l'écart d'exécution.
      expect(
        Math.abs(cutoff.getTime() - expectedCutoff.getTime()),
      ).toBeLessThan(5000);
    });

    it("Case 1 n'applique pas le garde-fou d'activité (détection des signalements jamais pris en charge)", async () => {
      mockFindMany.mockResolvedValue([]);

      await GET(createRequest());

      const case1Where = mockFindMany.mock.calls[0][0].where;
      expect(case1Where.NOT).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("returns 500 when a prisma query fails", async () => {
      mockFindMany.mockRejectedValue(new Error("DB connection lost"));

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Internal server error" });
      consoleSpy.mockRestore();
    });
  });

  describe("notifications", () => {
    it("sends an overdue email to the active author", async () => {
      mockFindMany
        .mockResolvedValueOnce([
          createOverdueReport({ id: "r-1", subject: "Problème RSA" }),
        ])
        .mockResolvedValueOnce([]);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockSendTemplatedEmail).toHaveBeenCalledTimes(1);
      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        "REPORT_OVERDUE",
        expect.objectContaining({
          to: [{ email: "author@example.com", name: "Marie Durand" }],
        }),
      );
    });

    it("sends the report URL in the email params", async () => {
      mockFindMany
        .mockResolvedValueOnce([
          createOverdueReport({ id: "r-1", subject: "Problème RSA" }),
        ])
        .mockResolvedValueOnce([]);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        "REPORT_OVERDUE",
        expect.objectContaining({
          params: {
            userFirstName: "Marie",
            reportSubject: "Problème RSA",
            reportUrl: "https://admin-plus.example.com/signalement/r-1",
          },
        }),
      );
    });

    it("reports the email failures in the mattermost message", async () => {
      mockFindMany
        .mockResolvedValueOnce([
          createOverdueReport({ id: "r-1", subject: "Problème RSA" }),
        ])
        .mockResolvedValueOnce([]);
      mockSendTemplatedEmail.mockResolvedValue({
        success: false,
        error: "Template is not active",
      });

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("**1** échec(s) d'envoi d'e-mail"),
      );
      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("Template is not active"),
      );
    });

    it("says nothing about email failures when every send succeeds", async () => {
      mockFindMany
        .mockResolvedValueOnce([
          createOverdueReport({ id: "r-1", subject: "Problème RSA" }),
        ])
        .mockResolvedValueOnce([]);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.not.stringContaining("échec(s) d'envoi d'e-mail"),
      );
    });
  });
});
