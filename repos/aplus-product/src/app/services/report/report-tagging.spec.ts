import { APICallError } from "ai";
import { goldenTagStep } from "@/lib/ai/golden-dataset/golden-tag";
import { createPipelineBudget } from "@/utils/pipeline-budget";
import { API_FAILURE_THRESHOLD } from "@/utils/pseudonymization-policy";
import { tagReports, taggingRecipe } from "./report-tagging";

jest.mock("@/lib/ai/golden-dataset/golden-tag", () => ({
  ...jest.requireActual("@/lib/ai/golden-dataset/golden-tag"),
  goldenTagStep: { name: "golden-tag", run: jest.fn() },
}));

const run = goldenTagStep.run as jest.Mock;

function candidate(id: string, overrides = {}) {
  return {
    id,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    status: "IN_TREATMENT",
    pseudonymizationStatus: null,
    subject: "Texte réel",
    description: "Texte réel",
    pseudonymized: { subject: "Sujet [NOM_1]", description: "Desc [NOM_1]" },
    requestedTeams: [
      { organization: { shortName: "CAF" } },
      { organization: { shortName: "CAF" } },
    ],
    ...overrides,
  };
}

function createMockPrisma(candidates: unknown[]) {
  return {
    report: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(candidates)
        .mockResolvedValue([]),
    },
    reportTagging: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

function outage(): APICallError {
  return new APICallError({
    message: "indisponible",
    url: "https://example.invalid/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 503,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  run.mockResolvedValue({
    procedureTag: "demande rsa",
    blockageTag: "dette",
    rawOutput: "BLOCAGE: dette\nDEMARCHE: demande rsa",
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("tagReports", () => {
  it("ne tourne pas sans modèle configuré", async () => {
    const prisma = createMockPrisma([candidate("r1")]);

    const result = await tagReports(
      prisma as never,
      createPipelineBudget(10),
      undefined,
    );

    expect(result).toEqual({ model: null, tagged: 0, refused: 0, errors: [] });
    expect(prisma.report.findMany).not.toHaveBeenCalled();
  });

  it("étiquette sur le texte pseudonymisé seul et stocke libellés fins et tags fermés", async () => {
    const prisma = createMockPrisma([candidate("r1")]);
    const { recipe, recipeKey } = taggingRecipe("modele");

    const result = await tagReports(
      prisma as never,
      createPipelineBudget(10),
      "modele",
    );

    expect(result.tagged).toBe(1);
    const { item, recipe: sent } = run.mock.calls[0][0];
    expect(item).toEqual({
      id: "r1",
      organization: "CAF",
      subject: "Sujet [NOM_1]",
      description: "Desc [NOM_1]",
    });
    expect(sent).toEqual(recipe);
    expect(prisma.reportTagging.upsert).toHaveBeenCalledWith({
      where: { reportId_recipeKey: { reportId: "r1", recipeKey } },
      create: {
        reportId: "r1",
        recipeKey,
        procedureLabel: "demande rsa",
        procedureTag: "RSA",
        blockageLabel: "dette",
        blockageTag: "dette ou retenue",
      },
      update: {},
    });
  });

  it("n'envoie jamais le texte d'un signalement qui n'a pas été caviardé", async () => {
    const prisma = createMockPrisma([candidate("r1", { pseudonymized: null })]);

    await tagReports(prisma as never, createPipelineBudget(10), "modele");

    expect(run).not.toHaveBeenCalled();
  });

  it("ne cherche que les signalements jamais étiquetés, quel que soit le modèle", async () => {
    const prisma = createMockPrisma([]);

    await tagReports(prisma as never, createPipelineBudget(10), "modele");

    const { where } = prisma.report.findMany.mock.calls[0][0];
    expect(where.AND[0]).toEqual({ taggings: { none: {} } });
  });

  it("s'arrête au budget et pendant une panne", async () => {
    const budget = createPipelineBudget(1);
    const prisma = createMockPrisma([candidate("r1"), candidate("r2")]);

    await tagReports(prisma as never, budget, "modele");
    expect(run).toHaveBeenCalledTimes(1);

    run.mockClear();
    run.mockRejectedValue(outage());
    const many = Array.from({ length: 6 }, (_, index) =>
      candidate(`o${index}`),
    );
    const outageBudget = createPipelineBudget(100);
    const result = await tagReports(
      createMockPrisma(many) as never,
      outageBudget,
      "modele",
    );

    expect(run.mock.calls.length).toBeLessThanOrEqual(
      API_FAILURE_THRESHOLD + 1,
    );
    expect(result.errors).toEqual([]);
  });

  it("consigne une erreur de code sans la prendre pour une panne", async () => {
    run.mockRejectedValue(new Error("bug"));

    const result = await tagReports(
      createMockPrisma([candidate("r1")]) as never,
      createPipelineBudget(10),
      "modele",
    );

    expect(result.errors).toEqual([{ reportId: "r1", error: "bug" }]);
  });
});

describe("taggingRecipe", () => {
  it("reprend la recette validée : labels fins, température 0,2", () => {
    const { recipe, recipeKey } = taggingRecipe("modele");
    expect(recipe.temperature).toBe(0.2);
    expect(recipe.systemPrompt).toContain("Libellés possibles");
    expect(recipeKey).toMatch(/^modele:[0-9a-f]{64}:t0\.2:v1$/);
  });
});
