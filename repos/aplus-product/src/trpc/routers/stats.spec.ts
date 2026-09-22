import { Prisma } from "@/generated/prisma/client";
import { createCallerFactory } from "../init";
import { statsRouter } from "./stats";
import prisma from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

// Jest résout `@/generated/prisma/client` vers le build navigateur, sans les
// helpers SQL ; on branche ceux du runtime pour inspecter le vrai SQL produit.
jest.mock("@/generated/prisma/client", () => {
  const runtime = jest.requireActual("@prisma/client/runtime/client");
  return {
    Prisma: {
      sql: runtime.sqltag,
      join: runtime.join,
      empty: runtime.empty,
    },
  };
});

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

const createCaller = createCallerFactory(statsRouter);
const queryRaw = prisma.$queryRaw as jest.Mock;

function createAnonymousCaller() {
  return createCaller({ userId: null, user: null });
}

function executedSql(): string[] {
  return queryRaw.mock.calls.map(([query]: [Prisma.Sql]) => query.sql);
}

describe("statsRouter", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("counts DELETED reports as « Supprimé », last in reportsByStatus", async () => {
    queryRaw.mockImplementation(async (query: Prisma.Sql) =>
      query.sql.includes('"reportStatus" AS status')
        ? [
            { status: "DELETED", count: 3 },
            { status: "CLOSED", count: 5 },
            { status: "PENDING_ASSIGNMENT", count: 1 },
          ]
        : [],
    );

    const { reportsByStatus } = await createAnonymousCaller().getDashboard({});

    expect(reportsByStatus).toEqual({
      labels: ["En attente de prise en charge", "Fermé", "Supprimé"],
      values: [1, 5, 3],
    });
  });

  it.each([
    ["without filter", {}],
    ["with startDate", { startDate: "2026-01-01" }],
  ])(
    "never filters DELETED reports out of the SQL (%s)",
    async (_label, filters) => {
      queryRaw.mockResolvedValue([]);
      const caller = createAnonymousCaller();

      await caller.getDashboard(filters);
      await caller.getCareDelaysByTeam(filters);

      const sql = executedSql();
      expect(sql.length).toBeGreaterThan(0);
      for (const statement of sql) {
        expect(statement).not.toContain("DELETED");
      }
    },
  );

  it("keeps a valid WHERE clause when only extra conditions remain", async () => {
    queryRaw.mockResolvedValue([]);

    await createAnonymousCaller().getDashboard({});

    const takenInCharge = executedSql().find((statement) =>
      statement.includes('"hasTakenInCharge" = true'),
    );
    expect(takenInCharge).toMatch(
      /WHERE\s+"hasTakenInCharge" = true\s+GROUP BY/,
    );
  });

  it("measures the care delay up to the first operator action, guarded by hasTakenInCharge", async () => {
    queryRaw.mockResolvedValue([]);

    await createAnonymousCaller().getDashboard({});

    const sql = executedSql();
    const careDelay = sql.filter((statement) =>
      statement.includes('LEAST("takenInChargeDelayBusinessDays"'),
    );
    expect(careDelay).toHaveLength(1);
    expect(careDelay[0]).toContain('"hasTakenInCharge" = true');
    for (const statement of sql) {
      expect(statement).not.toContain('"firstAnswerDelayBusinessDays"');
      expect(statement).not.toContain('"firstAnswerBusinessDaysBucket"');
      expect(statement).not.toContain('"inTreatmentDelayBusinessDays"');
    }
  });

  it("derives the 72h share from the care delay buckets, on taken-in-charge reports only", async () => {
    queryRaw.mockImplementation(async (query: Prisma.Sql) =>
      query.sql.includes('LEAST("takenInChargeDelayBusinessDays"')
        ? [
            { bucket: 0, count: 5 },
            { bucket: 1, count: 3 },
            { bucket: 3, count: 2 },
            { bucket: 4, count: 1 },
            { bucket: 7, count: 4 },
          ]
        : [],
    );

    const { takenInCharge72h, takenInChargeDelayDays } =
      await createAnonymousCaller().getDashboard({});

    expect(takenInCharge72h).toEqual({
      labels: ["3 jours ouvrés ou moins", "Plus de 3 jours ouvrés"],
      values: [10, 5],
    });
    expect(takenInChargeDelayDays.values).toEqual([5, 3, 2, 1, 4]);
    for (const statement of executedSql()) {
      expect(statement).not.toContain("'Non pris en charge'");
    }
  });

  it("measures the treatment delay up to the first COMPLETED, guarded by hasCompleted", async () => {
    queryRaw.mockResolvedValue([]);

    await createAnonymousCaller().getDashboard({});

    const sql = executedSql();
    const treatmentDelay = sql.filter((statement) =>
      statement.includes('LEAST("completedDelayBusinessDays"'),
    );
    expect(treatmentDelay).toHaveLength(1);
    expect(treatmentDelay[0]).toContain('"hasCompleted" = true');
    for (const statement of sql) {
      expect(statement.toLowerCase()).not.toContain("resolution");
    }
  });

  it("always returns the 11 treatment delay buckets, empty ones at 0", async () => {
    queryRaw.mockImplementation(async (query: Prisma.Sql) =>
      query.sql.includes('LEAST("completedDelayBusinessDays"')
        ? [
            { bucket: 1, count: 2 },
            { bucket: 5, count: 1 },
            { bucket: 10, count: 3 },
          ]
        : [],
    );

    const { treatmentDelay } = await createAnonymousCaller().getDashboard({});

    expect(treatmentDelay).toEqual({
      labels: [
        "0 jour ouvré",
        "1 jour ouvré",
        "2 jours ouvrés",
        "3 jours ouvrés",
        "4 jours ouvrés",
        "5 jours ouvrés",
        "6 jours ouvrés",
        "7 jours ouvrés",
        "8 jours ouvrés",
        "9 jours ouvrés",
        "10 jours ouvrés et +",
      ],
      values: [0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 3],
    });
  });

  it("keeps the per-team table on the IN_TREATMENT delay", async () => {
    queryRaw.mockResolvedValue([]);

    await createAnonymousCaller().getCareDelaysByTeam({});

    const sql = executedSql();
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain('"inTreatmentDelayBusinessDays"');
    expect(sql[0]).toContain('"hasInTreatment"');
    expect(sql[0]).not.toContain('"takenInChargeDelayBusinessDays"');
  });
});
