// --- Mocks ---

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {},
}));

const mockProcessReportDeletion = jest.fn();
jest.mock("@/app/services/report/report-deletion", () => ({
  processReportDeletion: (...args: unknown[]) =>
    mockProcessReportDeletion(...args),
}));

const mockValidateCronAuth = jest.fn();
jest.mock("@/utils/cron-auth", () => ({
  validateCronAuth: (...args: unknown[]) => mockValidateCronAuth(...args),
}));

const mockPostToMattermost = jest.fn();
jest.mock("@/app/services/mattermost.service", () => ({
  postToMattermost: (...args: unknown[]) => mockPostToMattermost(...args),
}));

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

const emptyResult = {
  reportsDeleted: [],
  skipped: [],
  fileErrors: [],
  errors: [],
};

// --- Setup ---

beforeEach(() => {
  jest.clearAllMocks();
  afterCallbacks.length = 0;
  mockValidateCronAuth.mockReturnValue(null);
  mockPostToMattermost.mockResolvedValue({ success: true });
  mockProcessReportDeletion.mockResolvedValue(emptyResult);
});

// --- Tests ---

describe("GET /api/cron/reports/deletion", () => {
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
      expect(mockProcessReportDeletion).not.toHaveBeenCalled();
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

  describe("processing", () => {
    it("responds immediately and runs the deletion in the after callback", async () => {
      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: "Report deletion started" });
      expect(mockProcessReportDeletion).not.toHaveBeenCalled();

      await flushAfterCallbacks();
      expect(mockProcessReportDeletion).toHaveBeenCalledTimes(1);
    });

    it("posts the summary to Mattermost when reports were deleted", async () => {
      mockProcessReportDeletion.mockResolvedValue({
        reportsDeleted: [{ id: "report-123" }],
        skipped: [],
        fileErrors: [],
        errors: [],
      });

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("Suppression de signalements"),
      );
      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("report-1"),
      );
    });

    it("posts the no-reports message when nothing was deleted", async () => {
      mockProcessReportDeletion.mockResolvedValue(emptyResult);

      await GET(createRequest());
      await flushAfterCallbacks();

      expect(mockPostToMattermost).toHaveBeenCalledWith(
        expect.stringContaining("Aucun signalement à supprimer"),
      );
    });

    it("does not throw when the service fails inside the after callback", async () => {
      mockProcessReportDeletion.mockRejectedValue(new Error("boom"));
      // Le logger écrit sur stderr et non via console.* : `removeConsole`
      // supprime les `console.*` du bundle en production (cf. utils/logger.ts).
      const stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      const response = await GET(createRequest());
      expect(response.status).toBe(200);

      await flushAfterCallbacks();

      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Report Deletion CRON] Error"),
      );
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("boom"));
      stderrSpy.mockRestore();
    });
  });
});
