import { APICallError } from "ai";
import { pseudonymizeMissingPieces } from "./pseudonymized-report";
import { pseudonymizeAndTagNewReport } from "./report-intake-ai";
import {
  TAGGING_REPORT_SELECT,
  tagReport,
  taggingRecipe,
} from "./report-tagging";

jest.mock("./pseudonymized-report", () => ({
  ...jest.requireActual("./pseudonymized-report"),
  pseudonymizeMissingPieces: jest.fn(),
}));

jest.mock("./report-tagging", () => ({
  ...jest.requireActual("./report-tagging"),
  tagReport: jest.fn(),
}));

const mockCaptureException = jest.fn();
jest.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

const pseudonymize = pseudonymizeMissingPieces as jest.Mock;
const tag = tagReport as jest.Mock;

const content = {
  subject: "Sujet",
  description: "Description",
  firstName: "Réel",
  lastName: "Citoyen",
  maritalName: null,
  birthDate: "01/01/1980",
  author: null,
  pseudonymized: null,
  answers: [],
};

const taggable = {
  id: "r1",
  pseudonymized: { subject: "Sujet [NOM_1]", description: "Desc [NOM_1]" },
  requestedTeams: [{ organization: { shortName: "CAF" } }],
};

function createMockPrisma() {
  return {
    report: {
      findUnique: jest.fn(async (args: { select: object }) =>
        args.select === TAGGING_REPORT_SELECT ? taggable : content,
      ),
    },
    reportPseudonymizationRefusal: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  process.env = {
    ...ORIGINAL_ENV,
    REPORT_PSEUDONYMIZATION_CRON_ENABLED: "true",
    ALBERT_MODEL: "modele",
  };
  pseudonymize.mockResolvedValue({ outcome: "DONE", content: {} });
  tag.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

describe("pseudonymizeAndTagNewReport", () => {
  it("n'envoie rien à Albert quand l'interrupteur est éteint", async () => {
    process.env.REPORT_PSEUDONYMIZATION_CRON_ENABLED = "false";
    const prisma = createMockPrisma();

    await pseudonymizeAndTagNewReport(prisma as never, "r1");

    expect(prisma.report.findUnique).not.toHaveBeenCalled();
    expect(pseudonymize).not.toHaveBeenCalled();
    expect(tag).not.toHaveBeenCalled();
  });

  it("caviarde puis étiquette sur la seule copie pseudonymisée", async () => {
    const prisma = createMockPrisma();

    await pseudonymizeAndTagNewReport(prisma as never, "r1");

    expect(pseudonymize).toHaveBeenCalledWith(prisma, "r1", content);
    expect(prisma.report.findUnique).toHaveBeenLastCalledWith({
      where: { id: "r1" },
      select: TAGGING_REPORT_SELECT,
    });
    expect(tag).toHaveBeenCalledWith(prisma, taggable, taggingRecipe("modele"));
  });

  it("consigne un refus et n'étiquette pas", async () => {
    pseudonymize.mockResolvedValue({ outcome: "REFUSED" });
    const prisma = createMockPrisma();

    await pseudonymizeAndTagNewReport(prisma as never, "r1");

    expect(prisma.reportPseudonymizationRefusal.upsert).toHaveBeenCalledWith({
      where: { reportId: "r1" },
      create: { reportId: "r1", refusedAt: expect.any(Date) },
      update: { refusedAt: expect.any(Date) },
    });
    expect(tag).not.toHaveBeenCalled();
  });

  it("laisse le dossier au cron en cas de panne", async () => {
    pseudonymize.mockResolvedValue({ outcome: "OUTAGE" });
    const prisma = createMockPrisma();

    await pseudonymizeAndTagNewReport(prisma as never, "r1");

    expect(prisma.reportPseudonymizationRefusal.upsert).not.toHaveBeenCalled();
    expect(tag).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("n'étiquette pas sans modèle configuré", async () => {
    delete process.env.ALBERT_MODEL;
    const prisma = createMockPrisma();

    await pseudonymizeAndTagNewReport(prisma as never, "r1");

    expect(pseudonymize).toHaveBeenCalled();
    expect(tag).not.toHaveBeenCalled();
  });

  it("remonte un bug à Sentry sans rejeter", async () => {
    pseudonymize.mockRejectedValue(new Error("boom"));
    const prisma = createMockPrisma();

    await expect(
      pseudonymizeAndTagNewReport(prisma as never, "r1"),
    ).resolves.toBeUndefined();

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        fingerprint: ["report-intake-ai", "crash"],
        extra: { reportId: "r1" },
      }),
    );
  });

  it("ne signale pas à Sentry une panne du modèle d'étiquetage", async () => {
    tag.mockRejectedValue(
      new APICallError({
        message: "indisponible",
        url: "https://example.invalid/v1/chat/completions",
        requestBodyValues: {},
        statusCode: 503,
      }),
    );
    const prisma = createMockPrisma();

    await expect(
      pseudonymizeAndTagNewReport(prisma as never, "r1"),
    ).resolves.toBeUndefined();

    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
