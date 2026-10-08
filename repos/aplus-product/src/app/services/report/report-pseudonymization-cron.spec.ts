import { ReportStatus } from "@/generated/prisma/enums";
import { API_FAILURE_THRESHOLD } from "@/utils/pseudonymization-policy";
import { pseudonymizeMissingPieces } from "./pseudonymized-report";
import { processReportPseudonymization } from "./report-pseudonymization-cron";

jest.mock("./pseudonymized-report", () => ({
  ...jest.requireActual("./pseudonymized-report"),
  pseudonymizeMissingPieces: jest.fn(),
}));

const pseudonymize = pseudonymizeMissingPieces as jest.Mock;

function candidate(id: string, overrides = {}) {
  return {
    id,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    subject: "Sujet",
    description: "Description",
    firstName: "Réel",
    lastName: "Citoyen",
    maritalName: null,
    birthDate: "01/01/1980",
    author: null,
    pseudonymized: null,
    answers: [
      { id: `${id}-a1`, content: "R", author: null, pseudonymized: null },
    ],
    ...overrides,
  };
}

/** Une page par phase : sujets d'abord, réponses ensuite. */
function createMockPrisma(phases: { reports: unknown[]; answers: unknown[] }) {
  const findMany = jest.fn(
    async (args: { where: { AND: unknown[] }; orderBy?: unknown }) => {
      const [where, cursor] = args.where.AND as [
        { pseudonymized: { is?: null; isNot?: null } },
        object,
      ];
      if (Object.keys(cursor).length > 0) return [];
      return "isNot" in where.pseudonymized ? phases.answers : phases.reports;
    },
  );
  return {
    report: { findMany, count: jest.fn().mockResolvedValue(12) },
    answer: { count: jest.fn().mockResolvedValue(34) },
    reportPseudonymizationRefusal: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  process.env.REPORT_PSEUDONYMIZATION_CRON_ENABLED = "true";
  pseudonymize.mockResolvedValue({ outcome: "DONE", content: {} });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.REPORT_PSEUDONYMIZATION_CRON_ENABLED;
});

describe("processReportPseudonymization", () => {
  it("ne fait rien quand le drapeau est éteint", async () => {
    delete process.env.REPORT_PSEUDONYMIZATION_CRON_ENABLED;
    const prisma = createMockPrisma({
      reports: [candidate("r1")],
      answers: [],
    });

    const result = await processReportPseudonymization(prisma as never);

    expect(result.enabled).toBe(false);
    expect(prisma.report.findMany).not.toHaveBeenCalled();
  });

  it("pseudonymise les sujets, puis les réponses en attente", async () => {
    const prisma = createMockPrisma({
      reports: [candidate("r-new")],
      answers: [
        candidate("r-old", {
          pseudonymized: { subject: "S", description: "D" },
          answers: [
            {
              id: "a1",
              content: "R",
              author: null,
              pseudonymized: { content: "x" },
            },
            { id: "a2", content: "R", author: null, pseudonymized: null },
            { id: "a3", content: "R", author: null, pseudonymized: null },
          ],
        }),
      ],
    });

    const result = await processReportPseudonymization(prisma as never);

    expect(pseudonymize.mock.calls.map((call) => call[1])).toEqual([
      "r-new",
      "r-old",
    ]);
    expect(result.reportsPseudonymized).toBe(1);
    expect(result.answersPseudonymized).toBe(3);
    expect(result.callsUsed).toBe(2);
    expect(result.reportsAwaiting).toBe(12);
    expect(result.answersAwaiting).toBe(34);
  });

  it("ne vise ni les signalements supprimés ni les refus récents, les plus récents d'abord", async () => {
    const prisma = createMockPrisma({ reports: [], answers: [] });

    await processReportPseudonymization(prisma as never);

    const [first, second] = prisma.report.findMany.mock.calls.map(
      (call) => call[0],
    );
    const common = {
      status: { not: ReportStatus.DELETED },
      NOT: {
        pseudonymizationRefusal: {
          is: { refusedAt: { gt: expect.any(Date) } },
        },
      },
    };
    const newestFirst = [{ createdAt: "desc" }, { id: "desc" }];

    expect(first).toMatchObject({
      where: { AND: [{ ...common, pseudonymized: { is: null } }, {}] },
      orderBy: newestFirst,
    });
    expect(second).toMatchObject({
      where: {
        AND: [
          {
            ...common,
            pseudonymized: { isNot: null },
            answers: { some: { pseudonymized: { is: null } } },
          },
          {},
        ],
      },
      orderBy: newestFirst,
    });
  });

  it("consigne un refus pour ne retenter le dossier qu'après le délai", async () => {
    pseudonymize.mockResolvedValue({ outcome: "REFUSED" });
    const prisma = createMockPrisma({
      reports: [candidate("r1")],
      answers: [],
    });

    const result = await processReportPseudonymization(prisma as never);

    expect(result.refused).toBe(1);
    expect(prisma.reportPseudonymizationRefusal.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reportId: "r1" } }),
    );
  });

  it("partage un seul budget d'appels entre les phases", async () => {
    const prisma = createMockPrisma({
      reports: [candidate("r1"), candidate("r2"), candidate("r3")],
      answers: [],
    });

    const result = await processReportPseudonymization(prisma as never, 2);

    expect(pseudonymize).toHaveBeenCalledTimes(2);
    expect(result.callsUsed).toBe(2);
  });

  it("s'arrête après des pannes consécutives", async () => {
    pseudonymize.mockResolvedValue({ outcome: "OUTAGE" });
    const prisma = createMockPrisma({
      reports: Array.from({ length: 10 }, (_, index) => candidate(`r${index}`)),
      answers: [],
    });

    const result = await processReportPseudonymization(prisma as never);

    expect(result.outage).toBe(true);
    expect(pseudonymize.mock.calls.length).toBeLessThanOrEqual(
      API_FAILURE_THRESHOLD + 1,
    );
  });

  it("consigne une erreur de code et passe au dossier suivant", async () => {
    pseudonymize
      .mockRejectedValueOnce(new Error("bug"))
      .mockResolvedValue({ outcome: "DONE", content: {} });
    const prisma = createMockPrisma({
      reports: [candidate("r1"), candidate("r2")],
      answers: [],
    });

    const result = await processReportPseudonymization(prisma as never);

    expect(result.errors).toEqual([{ reportId: "r1", error: "bug" }]);
    expect(result.reportsPseudonymized).toBe(1);
  });
});
