jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {},
}));

const mockProcess = jest.fn();
jest.mock("@/app/services/report/report-pseudonymization-cron", () => ({
  processReportPseudonymization: (...args: unknown[]) => mockProcess(...args),
}));

const mockValidateCronAuth = jest.fn();
jest.mock("@/utils/cron-auth", () => ({
  validateCronAuth: (...args: unknown[]) => mockValidateCronAuth(...args),
}));

const mockPostToMattermost = jest.fn();
jest.mock("@/app/services/mattermost.service", () => ({
  postToMattermost: (...args: unknown[]) => mockPostToMattermost(...args),
}));

const mockSendAlerts = jest.fn();
jest.mock("@/app/services/report/report-pseudonymization-cron-alerts", () => ({
  sendReportPseudonymizationAlerts: (...args: unknown[]) =>
    mockSendAlerts(...args),
}));

const mockCaptureException = jest.fn();
jest.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
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

import { GET } from "./route";

function createRequest(token: string | null = "Bearer valid-token") {
  return {
    headers: {
      get: (name: string) => (name === "authorization" ? token : null),
    },
  } as never;
}

async function flushAfterCallbacks() {
  for (const cb of afterCallbacks) await cb();
  afterCallbacks.length = 0;
}

const result = {
  enabled: true,
  reportsPseudonymized: 3,
  answersPseudonymized: 7,
  refused: 1,
  errors: [],
  outage: false,
  callsUsed: 4,
  callLimit: 3000,
  reportsAwaiting: 10,
  answersAwaiting: 20,
};

beforeEach(() => {
  jest.clearAllMocks();
  afterCallbacks.length = 0;
  jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  mockValidateCronAuth.mockReturnValue(null);
  mockPostToMattermost.mockResolvedValue({ success: true });
  mockProcess.mockResolvedValue(result);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GET /api/cron/reports/pseudonymization", () => {
  it("refuse un appel non authentifié", async () => {
    mockValidateCronAuth.mockReturnValue({ status: 401 });

    const response = await GET(createRequest("Bearer invalid"));

    expect(response.status).toBe(401);
    expect(afterCallbacks).toHaveLength(0);
  });

  it("répond tout de suite et publie les compteurs après le run", async () => {
    const response = await GET(createRequest());
    expect(await response.json()).toEqual({
      message: "Report pseudonymization started",
    });
    expect(mockProcess).not.toHaveBeenCalled();

    await flushAfterCallbacks();

    expect(mockSendAlerts).toHaveBeenCalledWith(result);
    const message = mockPostToMattermost.mock.calls[0][0];
    expect(message).toContain("**3** signalement(s) · **7** réponse(s)");
  });

  it("ne publie rien quand le cron est désactivé", async () => {
    mockProcess.mockResolvedValue({ ...result, enabled: false });

    await GET(createRequest());
    await flushAfterCallbacks();

    expect(mockPostToMattermost).not.toHaveBeenCalled();
    expect(mockSendAlerts).not.toHaveBeenCalled();
  });

  it("remonte un plantage à Sentry", async () => {
    mockProcess.mockRejectedValue(new Error("boom"));

    await GET(createRequest());
    await flushAfterCallbacks();

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        fingerprint: ["report-pseudonymization", "crash"],
      }),
    );
  });
});
