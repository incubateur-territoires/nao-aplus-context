jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {},
}));

const mockTagReports = jest.fn();
jest.mock("@/app/services/report/report-tagging", () => ({
  TAGGING_CALLS_PER_RUN: 3000,
  tagReports: (...args: unknown[]) => mockTagReports(...args),
}));

const mockValidateCronAuth = jest.fn();
jest.mock("@/utils/cron-auth", () => ({
  validateCronAuth: (...args: unknown[]) => mockValidateCronAuth(...args),
}));

const mockPostToMattermost = jest.fn();
jest.mock("@/app/services/mattermost.service", () => ({
  postToMattermost: (...args: unknown[]) => mockPostToMattermost(...args),
}));

const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
jest.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
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

const result = { model: "modele", tagged: 2, refused: 1, errors: [] };

beforeEach(() => {
  jest.clearAllMocks();
  afterCallbacks.length = 0;
  jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  process.env.ALBERT_MODEL = "modele";
  mockValidateCronAuth.mockReturnValue(null);
  mockPostToMattermost.mockResolvedValue({ success: true });
  mockTagReports.mockResolvedValue(result);
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.ALBERT_MODEL;
});

describe("GET /api/cron/reports/tagging", () => {
  it("refuse un appel non authentifié", async () => {
    mockValidateCronAuth.mockReturnValue({ status: 401 });

    const response = await GET(createRequest("Bearer invalid"));

    expect(response.status).toBe(401);
    expect(afterCallbacks).toHaveLength(0);
  });

  it("répond tout de suite puis étiquette avec son propre budget", async () => {
    const response = await GET(createRequest());
    expect(await response.json()).toEqual({
      message: "Report tagging started",
    });
    expect(mockTagReports).not.toHaveBeenCalled();

    await flushAfterCallbacks();

    const [, budget, model] = mockTagReports.mock.calls[0];
    expect(budget.limit).toBe(3000);
    expect(model).toBe("modele");
    expect(mockCaptureMessage).not.toHaveBeenCalled();
    const message = mockPostToMattermost.mock.calls[0][0];
    expect(message).toContain("Étiquetés : **2** · **1** refus");
    expect(message).toContain("/ 3000");
  });

  it("remonte les erreurs d'étiquetage à Sentry sans texte de signalement", async () => {
    mockTagReports.mockResolvedValue({
      ...result,
      errors: [{ reportId: "r1", error: "bug" }],
    });

    await GET(createRequest());
    await flushAfterCallbacks();

    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Signalements non étiquetés",
      expect.objectContaining({
        fingerprint: ["report-tagging", "errors"],
        extra: { count: 1, errors: [{ reportId: "r1", error: "bug" }] },
      }),
    );
  });

  it("remonte un plantage à Sentry", async () => {
    mockTagReports.mockRejectedValue(new Error("boom"));

    await GET(createRequest());
    await flushAfterCallbacks();

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ fingerprint: ["report-tagging", "crash"] }),
    );
  });
});
