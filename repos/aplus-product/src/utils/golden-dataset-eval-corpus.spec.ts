import {
  buildEvalCorpus,
  findExport,
  readBlindSources,
  type GoldenExports,
} from "./golden-dataset-eval-corpus";
import { splitCorpus } from "./golden-dataset-split";

function csv(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

const ITEMS = csv([
  [
    "id",
    "reportId",
    "position",
    "organization",
    "subject",
    "description",
    "goldenBlockageTag",
    "goldenProcedureTag",
  ],
  ["i1", "r1", "1", "CAF", "Sujet un", "Texte\nsur deux lignes", "retard", ""],
  ["i2", "r2", "2", "CPAM", "Sujet deux", "Texte", "inconnu", "carte vitale"],
]);

const GOLDS = csv([
  ["id", "itemId", "taxonomyVersion", "blockageTag", "procedureTag"],
  ["g1", "i1", "1", "retard", "prestations sociales"],
  ["g2", "i2", "2", "autre", "autre"],
  ["g3", "absent", "1", "retard", "autre"],
]);

const ANNOTATIONS = csv([
  ["id", "itemId", "annotatorId", "blockageTag", "procedureTag"],
  ["a1", "i1", "u1", "retard", ""],
  ["a2", "i1", "u2", "délai", "rsa"],
]);

const EXPORTS: GoldenExports = {
  items: { fileName: "GoldenDatasetItem.csv", text: ITEMS },
  golds: { fileName: "GoldenDatasetGold.csv", text: GOLDS },
  annotations: { fileName: "GoldenDatasetAnnotation.csv", text: ANNOTATIONS },
};

describe("findExport", () => {
  const names = [
    "GoldenDatasetItem_202609241200.csv",
    "GoldenDatasetGold.csv",
    "GoldenDatasetAnnotation.csv",
    "notes.txt",
  ];

  it("trouve l'export d'une table, suffixe daté compris", () => {
    expect(findExport(names, "GoldenDatasetItem", "d")).toBe(
      "GoldenDatasetItem_202609241200.csv",
    );
  });

  it("nomme la table et le dossier quand l'export manque", () => {
    expect(() => findExport(["notes.txt"], "GoldenDatasetGold", "d")).toThrow(
      /GoldenDatasetGold introuvable dans d/,
    );
  });

  it("refuse deux exports de la même table", () => {
    expect(() =>
      findExport(
        ["GoldenDatasetGold.csv", "GoldenDatasetGold (1).csv"],
        "GoldenDatasetGold",
        "d",
      ),
    ).toThrow(/Plusieurs/);
  });
});

describe("readBlindSources", () => {
  it("ne lit que les colonnes visibles du modèle", () => {
    expect(readBlindSources(EXPORTS.items)).toEqual([
      {
        id: "i1",
        organization: "CAF",
        subject: "Sujet un",
        description: "Texte\nsur deux lignes",
      },
      {
        id: "i2",
        organization: "CPAM",
        subject: "Sujet deux",
        description: "Texte",
      },
    ]);
  });

  it("refuse un item en double", () => {
    const text = csv([
      ["id", "organization", "subject", "description"],
      ["i1", "CAF", "s", "d"],
      ["i1", "CAF", "s", "d"],
    ]);
    expect(() => readBlindSources({ fileName: "items.csv", text })).toThrow(
      /items\.csv : l'item i1/,
    );
  });
});

describe("buildEvalCorpus", () => {
  const { items, orphanRows } = buildEvalCorpus(EXPORTS, 1);
  const byId = new Map(items.map((item) => [item.id, item]));

  it("lit les golds fins de l'item, vide valant absence", () => {
    expect(byId.get("i1")?.fineGolds).toEqual({
      blockageTag: "retard",
      procedureTag: null,
    });
  });

  it("ne garde que les golds fermés de la version demandée", () => {
    expect(byId.get("i1")?.closedGolds).toEqual({
      blockageTag: "retard",
      procedureTag: "prestations sociales",
    });
    expect(byId.get("i2")?.closedGolds).toBeNull();
  });

  it("regroupe les tags non vides des annotateurs par axe", () => {
    expect(byId.get("i1")?.annotatorTags).toEqual({
      blockageTag: ["retard", "délai"],
      procedureTag: ["rsa"],
    });
    expect(byId.get("i2")?.annotatorTags).toEqual({
      blockageTag: [],
      procedureTag: [],
    });
  });

  it("applique le tirage figé", () => {
    const expected = splitCorpus([
      { id: "i1", organization: "CAF" },
      { id: "i2", organization: "CPAM" },
    ]);
    expect(items.map((item) => item.split)).toEqual([
      expected.get("i1"),
      expected.get("i2"),
    ]);
  });

  it("compte les lignes dont l'item manque", () => {
    expect(orphanRows).toBe(1);
  });

  it("nomme le fichier et la colonne manquante", () => {
    expect(() =>
      buildEvalCorpus(
        {
          ...EXPORTS,
          golds: { fileName: "GoldenDatasetGold.csv", text: '"id";"itemId"\n' },
        },
        1,
      ),
    ).toThrow(/GoldenDatasetGold\.csv : colonne « taxonomyVersion »/);
  });
});
