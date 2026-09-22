import { BLIND_SELECT, toBlindItem, type BlindItem } from "./blind-item";

describe("BLIND_SELECT", () => {
  it("sélectionne exactement les quatre champs visibles par le modèle", () => {
    expect(Object.keys(BLIND_SELECT).sort()).toEqual([
      "description",
      "id",
      "organization",
      "subject",
    ]);
  });

  it("ne demande jamais les annotations humaines", () => {
    expect(Object.keys(BLIND_SELECT)).not.toContain("annotations");
  });
});

describe("toBlindItem", () => {
  it("recopie les quatre champs et rien d'autre", () => {
    const item = toBlindItem({
      id: "item-1",
      organization: "CAF",
      subject: "Sujet caviardé",
      description: "Description caviardée de [NOM_1].",
    });

    expect(Object.keys(item)).toEqual([
      "id",
      "organization",
      "subject",
      "description",
    ]);
  });

  it("refuse à la compilation une ligne portant les annotations humaines", () => {
    const withAnnotations = {
      id: "item-1",
      organization: "CAF",
      subject: "Sujet caviardé",
      description: "Description caviardée.",
      annotations: [{ blockageTag: "compte inactif" }],
    };

    // @ts-expect-error une ligne annotée n'est pas une source aveugle
    expect(() => toBlindItem(withAnnotations)).not.toThrow();
  });

  it("refuse à la compilation un littéral non marqué là où un BlindItem est attendu", () => {
    function readBlindItem(item: BlindItem): string {
      return item.subject;
    }

    // @ts-expect-error seul toBlindItem peut produire un BlindItem
    const subject = readBlindItem({
      id: "item-1",
      organization: "CAF",
      subject: "Sujet caviardé",
      description: "Description caviardée.",
    });

    expect(subject).toBe("Sujet caviardé");
  });
});
