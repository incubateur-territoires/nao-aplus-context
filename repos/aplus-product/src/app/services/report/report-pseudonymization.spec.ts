import { APICallError } from "ai";
import { redactReport } from "@/lib/ai/redact-report";
import { AlbertQuotaError } from "@/lib/ai/providers";
import { createCounters } from "@/lib/ai/pseudonymize";
import {
  pseudonymizeReportContent,
  type ReportContent,
} from "./report-pseudonymization";

jest.mock("@/lib/ai/redact-report", () => ({ redactReport: jest.fn() }));

const redact = redactReport as jest.Mock;

function report(): ReportContent {
  return {
    subject: "Sujet",
    description: "Description",
    firstName: "Réel",
    lastName: "Citoyen",
    maritalName: null,
    birthDate: "01/01/1980",
    author: null,
    answers: [],
  };
}

function apiError(statusCode?: number): APICallError {
  return new APICallError({
    message: "appel refusé",
    url: "https://example.invalid/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  jest.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("pseudonymizeReportContent", () => {
  it("rend le texte caviardé quand la garde est satisfaite", async () => {
    redact.mockResolvedValue({
      subject: "S",
      description: "D",
      answers: [],
      matches: [],
      guard: { ok: true, violations: [] },
    });

    const attempt = await pseudonymizeReportContent("r", report());

    expect(attempt).toEqual({
      outcome: "DONE",
      content: { subject: "S", description: "D", answers: [] },
    });
  });

  it("refuse quand la garde cite des résidus", async () => {
    redact.mockResolvedValue({
      subject: "S",
      description: "D",
      answers: [],
      matches: [],
      guard: { ok: false, violations: [{ type: "RESIDUAL", value: "x" }] },
    });

    const attempt = await pseudonymizeReportContent("r", report());

    expect(attempt.outcome).toBe("REFUSED");
    expect(attempt.content).toBeUndefined();
  });

  it("classe un quota épuisé en panne", async () => {
    redact.mockRejectedValue(new AlbertQuotaError());

    const attempt = await pseudonymizeReportContent("r", report());

    expect(attempt.outcome).toBe("OUTAGE");
  });

  it("classe un 4xx hors 429 en refus", async () => {
    redact.mockRejectedValue(apiError(400));

    const attempt = await pseudonymizeReportContent("r", report());

    expect(attempt.outcome).toBe("REFUSED");
  });

  it("classe un 401 en panne", async () => {
    redact.mockRejectedValue(apiError(401));

    const attempt = await pseudonymizeReportContent("r", report());

    expect(attempt.outcome).toBe("OUTAGE");
  });

  it("laisse remonter une erreur de code", async () => {
    redact.mockRejectedValue(new TypeError("x is not a function"));

    await expect(pseudonymizeReportContent("r", report())).rejects.toThrow(
      "x is not a function",
    );
  });

  it("ne caviarde que les morceaux demandés, avec les noms de tout le fil", async () => {
    redact.mockResolvedValue({
      subject: "",
      description: "",
      answers: [{ id: "a2", content: "R2" }],
      matches: [],
      guard: { ok: true, violations: [] },
    });
    const offsets = { ...createCounters(), NAME: 2 };

    await pseudonymizeReportContent(
      "r",
      {
        ...report(),
        answers: [
          {
            id: "a1",
            content: "Déjà fait",
            author: { firstName: "Ana", lastName: "Roy" },
          },
          { id: "a2", content: "Nouvelle", author: null },
        ],
      },
      {
        includeReport: false,
        answerIds: new Set(["a2"]),
        tokenOffsets: offsets,
      },
    );

    expect(redact).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "",
        description: "",
        answers: [{ id: "a2", content: "Nouvelle" }],
        participantNames: ["Ana Roy"],
        tokenOffsets: offsets,
      }),
    );
  });
});
