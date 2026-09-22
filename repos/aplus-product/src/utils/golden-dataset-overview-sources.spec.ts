import {
  buildOverviewSources,
  buildRunLabels,
} from "./golden-dataset-overview-sources";

const CHARLES = { id: "charles-1", firstName: "Charles", lastName: "d'Oiron" };
const MANON = { id: "manon", firstName: "Manon", lastName: "Duval" };

const MISTRAL = "mistralai/Mistral-Small-3.2-24B-Instruct-2506";
const GPT = "openai/gpt-oss-120b";

describe("buildRunLabels", () => {
  it("retire le préfixe éditeur de l'identifiant du modèle", () => {
    const labels = buildRunLabels([
      { runId: "run-1", model: MISTRAL, temperature: 0.2 },
      { runId: "run-2", model: GPT, temperature: 0.2 },
    ]);

    expect(labels.get("run-1")).toBe("Mistral-Small-3.2-24B-Instruct-2506");
    expect(labels.get("run-2")).toBe("gpt-oss-120b");
  });

  it("garde tel quel un identifiant sans préfixe", () => {
    const labels = buildRunLabels([
      { runId: "run-1", model: "modele-maison", temperature: 0.2 },
    ]);

    expect(labels.get("run-1")).toBe("modele-maison");
  });

  it("ajoute la température aux séries du même modèle, sans quoi deux lignes se confondent", () => {
    const labels = buildRunLabels([
      { runId: "run-1", model: MISTRAL, temperature: 0.2 },
      { runId: "run-2", model: MISTRAL, temperature: 1 },
      { runId: "run-3", model: GPT, temperature: 0.2 },
    ]);

    expect(labels.get("run-1")).toBe(
      "Mistral-Small-3.2-24B-Instruct-2506 (température 0,2)",
    );
    expect(labels.get("run-2")).toBe(
      "Mistral-Small-3.2-24B-Instruct-2506 (température 1)",
    );
    expect(labels.get("run-3")).toBe("gpt-oss-120b");
  });

  it("traite deux éditeurs du même modèle comme une ambiguïté", () => {
    const labels = buildRunLabels([
      { runId: "run-1", model: "editeur-a/mixtral", temperature: 0.2 },
      { runId: "run-2", model: "editeur-b/mixtral", temperature: 0.7 },
    ]);

    expect(labels.get("run-1")).toBe("mixtral (température 0,2)");
    expect(labels.get("run-2")).toBe("mixtral (température 0,7)");
  });

  it("renvoie une table vide sans série", () => {
    expect(buildRunLabels([]).size).toBe(0);
  });
});

describe("buildOverviewSources", () => {
  it("place les sources humaines avant les séries de modèles", () => {
    const sources = buildOverviewSources(
      [CHARLES, MANON],
      [
        { runId: "run-1", model: MISTRAL, temperature: 0.2 },
        { runId: "run-2", model: GPT, temperature: 0.2 },
      ],
    );

    expect(sources).toEqual([
      { key: "charles-1", label: "Charles", kind: "human" },
      { key: "manon", label: "Manon", kind: "human" },
      {
        key: "run-1",
        label: "Mistral-Small-3.2-24B-Instruct-2506",
        kind: "model",
      },
      { key: "run-2", label: "gpt-oss-120b", kind: "model" },
    ]);
  });

  it("garde l'ordre reçu de part et d'autre", () => {
    const sources = buildOverviewSources(
      [MANON, CHARLES],
      [
        { runId: "run-2", model: GPT, temperature: 0.2 },
        { runId: "run-1", model: MISTRAL, temperature: 0.2 },
      ],
    );

    expect(sources.map((source) => source.key)).toEqual([
      "manon",
      "charles-1",
      "run-2",
      "run-1",
    ]);
  });

  it("désambiguïse les homonymes de chaque côté sans toucher à l'autre", () => {
    const sources = buildOverviewSources(
      [CHARLES, { id: "charles-2", firstName: "Charles", lastName: "Duval" }],
      [
        { runId: "run-1", model: MISTRAL, temperature: 0.2 },
        { runId: "run-2", model: MISTRAL, temperature: 1 },
      ],
    );

    expect(sources.map((source) => source.label)).toEqual([
      "Charles d'Oiron",
      "Charles Duval",
      "Mistral-Small-3.2-24B-Instruct-2506 (température 0,2)",
      "Mistral-Small-3.2-24B-Instruct-2506 (température 1)",
    ]);
  });

  it("rend une liste vide sans annotateur ni série", () => {
    expect(buildOverviewSources([], [])).toEqual([]);
  });

  it("rend les seules sources humaines quand aucune série n'a tourné", () => {
    const sources = buildOverviewSources([CHARLES], []);

    expect(sources).toEqual([
      { key: "charles-1", label: "Charles", kind: "human" },
    ]);
  });
});
