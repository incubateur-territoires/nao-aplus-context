import { buildAnnotatorLabels } from "./golden-dataset-annotator-label";

describe("buildAnnotatorLabels", () => {
  it("garde le prénom seul quand il est unique", () => {
    const labels = buildAnnotatorLabels([
      { id: "a", firstName: "Manon", lastName: "Duval" },
      { id: "b", firstName: "Charles", lastName: "Le Prévost" },
    ]);

    expect(labels.get("a")).toBe("Manon");
    expect(labels.get("b")).toBe("Charles");
  });

  it("ajoute le nom aux prénoms partagés, sans quoi deux annotateurs se confondent", () => {
    const labels = buildAnnotatorLabels([
      { id: "a", firstName: "Charles", lastName: "d'Oiron" },
      { id: "b", firstName: "Charles", lastName: "Le Prévost" },
      { id: "c", firstName: "Manon", lastName: "Duval" },
    ]);

    expect(labels.get("a")).toBe("Charles d'Oiron");
    expect(labels.get("b")).toBe("Charles Le Prévost");
    expect(labels.get("c")).toBe("Manon");
  });

  it("traite deux graphies du même prénom comme une ambiguïté", () => {
    const labels = buildAnnotatorLabels([
      { id: "a", firstName: "Raphaël", lastName: "Bourreau" },
      { id: "b", firstName: "raphael", lastName: "Martin" },
    ]);

    expect(labels.get("a")).toBe("Raphaël Bourreau");
    expect(labels.get("b")).toBe("raphael Martin");
  });

  it("renvoie une table vide sans annotateur", () => {
    expect(buildAnnotatorLabels([]).size).toBe(0);
  });
});
