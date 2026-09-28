import {
  emptyRunFile,
  parseRunFile,
  runFileName,
  sameRecipe,
  scoringPredictionsOf,
  type EvalRecipe,
} from "./golden-dataset-eval-run";

const RECIPE: EvalRecipe = {
  model: "org/modele:7b",
  mode: "closed",
  taxonomyVersion: 1,
  systemPrompt: "consigne",
  userTemplate: "{{subject}}",
  promptHash: "abcdef0123456789",
  temperature: 0.2,
  createdAt: "2026-09-24T10:00:00.000Z",
  note: null,
};

describe("runFileName", () => {
  it("dérive un nom sûr du mode, du modèle, du hash et de la température", () => {
    expect(runFileName(RECIPE)).toBe(
      "closed_org-modele-7b_abcdef012345_t0.2.json",
    );
  });
});

describe("sameRecipe", () => {
  it("ignore la date mais pas la température", () => {
    expect(sameRecipe(RECIPE, { ...RECIPE, createdAt: "autre" })).toBe(true);
    expect(sameRecipe(RECIPE, { ...RECIPE, temperature: 0 })).toBe(false);
  });
});

describe("parseRunFile", () => {
  it("lit une série écrite avant la note comme une série sans note", () => {
    const recipe: Partial<EvalRecipe> = { ...RECIPE };
    delete recipe.note;
    const file = { format: 1, recipe, predictions: {} };

    expect(parseRunFile(JSON.stringify(file), "f.json").recipe.note).toBeNull();
  });

  const file = {
    ...emptyRunFile(RECIPE),
    predictions: {
      i1: {
        blockageTag: "retard",
        procedureTag: null,
        rawOutput: "BLOCAGE: retard",
        latencyMs: 10,
        inputTokens: 5,
        outputTokens: 3,
      },
    },
  };

  it("relit ce qui a été écrit", () => {
    expect(parseRunFile(JSON.stringify(file), "f.json")).toEqual(file);
  });

  it("nomme le fichier et le champ fautif", () => {
    const broken = { ...file, recipe: { ...RECIPE, mode: "libre" } };
    expect(() => parseRunFile(JSON.stringify(broken), "f.json")).toThrow(
      /f\.json : fichier de série invalide, recipe\.mode/,
    );
  });

  it("nomme le fichier quand le JSON est illisible", () => {
    expect(() => parseRunFile("{", "f.json")).toThrow(
      /f\.json : JSON illisible/,
    );
  });

  it("donne les prédictions à corriger", () => {
    expect(scoringPredictionsOf(file)).toEqual([
      { itemId: "i1", blockageTag: "retard", procedureTag: null },
    ]);
  });
});
