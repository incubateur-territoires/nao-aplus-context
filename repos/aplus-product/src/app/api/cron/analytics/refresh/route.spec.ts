// --- Mocks ---

const mockExecuteRawUnsafe = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
  },
}));

const mockValidateCronAuth = jest.fn();
jest.mock("@/utils/cron-auth", () => ({
  validateCronAuth: (...args: unknown[]) => mockValidateCronAuth(...args),
}));

// Mock next/server to avoid Request/Response polyfill issues in jsdom
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
  NextRequest: jest.fn(),
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

// --- Setup ---

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateCronAuth.mockReturnValue(null);
  mockExecuteRawUnsafe.mockResolvedValue(0);
});

// --- Tests ---

describe("GET /api/cron/analytics/refresh", () => {
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
      expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("runs REFRESH MATERIALIZED VIEW CONCURRENTLY on the analytics view", async () => {
      const response = await GET(createRequest());
      const data = await response.json();

      expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
      expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
        "REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.v_report_fact",
      );
      expect(response.status).toBe(200);
      expect(data.message).toBe("Materialized view refreshed");
      expect(data.view).toBe("analytics.v_report_fact");
      expect(typeof data.durationMs).toBe("number");
    });
  });

  describe("error handling", () => {
    it("returns 500 when the refresh fails", async () => {
      mockExecuteRawUnsafe.mockRejectedValue(new Error("DB connection lost"));

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
});
