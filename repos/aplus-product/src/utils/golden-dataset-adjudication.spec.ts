import {
  axisTags,
  axisVerdict,
  itemGroup,
  unanimousChoice,
  unanimousFills,
  type AdjudicationItem,
} from "@/utils/golden-dataset-adjudication";

function buildItem(
  overrides: Partial<AdjudicationItem> = {},
): AdjudicationItem {
  return {
    goldenBlockageTag: null,
    goldenProcedureTag: null,
    annotations: [],
    ...overrides,
  };
}

describe("axisTags", () => {
  it("rend les tags de l'axe demandé, dans l'ordre des annotations", () => {
    const item = buildItem({
      annotations: [
        { blockageTag: "retard", procedureTag: "rsa" },
        { blockageTag: null, procedureTag: "cmu" },
        { blockageTag: "dossier bloqué", procedureTag: null },
      ],
    });

    expect(axisTags(item, "blockageTag")).toEqual(["retard", "dossier bloqué"]);
    expect(axisTags(item, "procedureTag")).toEqual(["rsa", "cmu"]);
  });
});

describe("axisVerdict", () => {
  it("dit « untagged » quand personne n'a tagué l'axe", () => {
    expect(axisVerdict([])).toBe("untagged");
  });

  it("dit « single » quand un seul annotateur a tagué l'axe", () => {
    expect(axisVerdict(["retard"])).toBe("single");
  });

  it("dit « unanimous » quand tous les tags s'accordent", () => {
    expect(axisVerdict(["retard", "retard", "retard"])).toBe("unanimous");
  });

  it("dit « divergent » dès qu'un tag s'écarte des autres", () => {
    expect(axisVerdict(["retard", "retard", "dossier bloqué"])).toBe(
      "divergent",
    );
  });

  it("compte comme unanimité des tags qui ne diffèrent que par la casse et les accents", () => {
    expect(axisVerdict(["Délai Anormal", "delai anormal"])).toBe("unanimous");
  });
});

describe("unanimousChoice", () => {
  it("ne désigne rien quand l'axe est divergent, vide ou porté par un seul annotateur", () => {
    expect(unanimousChoice([])).toBeNull();
    expect(unanimousChoice(["retard"])).toBeNull();
    expect(unanimousChoice(["retard", "dossier bloqué"])).toBeNull();
  });

  it("retient la forme exacte majoritaire quand deux variantes équivalentes coexistent", () => {
    expect(
      unanimousChoice(["delai anormal", "Délai anormal", "delai anormal"]),
    ).toBe("delai anormal");
  });

  it("tranche une égalité en faveur de la première forme rencontrée", () => {
    expect(unanimousChoice(["Délai anormal", "delai anormal"])).toBe(
      "Délai anormal",
    );
  });
});

describe("itemGroup", () => {
  it("classe en « adjudicated » un item dont les deux axes sont retenus", () => {
    const item = buildItem({
      goldenBlockageTag: "dossier bloqué",
      goldenProcedureTag: "rsa",
      annotations: [{ blockageTag: "retard", procedureTag: "cmu" }],
    });

    expect(itemGroup(item)).toBe("adjudicated");
  });

  it("classe en « unanimous » un item non tranché dont les deux axes font l'unanimité", () => {
    const item = buildItem({
      annotations: [
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
        { blockageTag: "Dossier bloqué", procedureTag: "rsa" },
      ],
    });

    expect(itemGroup(item)).toBe("unanimous");
  });

  it("classe en « toDiscuss » un item dont un seul axe fait l'unanimité", () => {
    const item = buildItem({
      annotations: [
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
        { blockageTag: "dossier bloqué", procedureTag: "cmu" },
      ],
    });

    expect(itemGroup(item)).toBe("toDiscuss");
  });

  it("classe en « toDiscuss » un item dont un seul axe est déjà retenu", () => {
    const item = buildItem({
      goldenBlockageTag: "dossier bloqué",
      annotations: [{ blockageTag: "retard", procedureTag: "rsa" }],
    });

    expect(itemGroup(item)).toBe("toDiscuss");
  });

  it("classe en « toDiscuss » un item que personne n'a annoté", () => {
    expect(itemGroup(buildItem())).toBe("toDiscuss");
  });
});

describe("unanimousFills", () => {
  it("rend les deux axes unanimes d'un item que rien ne tranche encore", () => {
    const item = buildItem({
      annotations: [
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
        { blockageTag: "Dossier bloqué", procedureTag: "rsa" },
      ],
    });

    expect(unanimousFills(item)).toEqual([
      { axis: "blockageTag", tag: "dossier bloqué" },
      { axis: "procedureTag", tag: "rsa" },
    ]);
  });

  it("écarte un axe déjà retenu, même s'il fait l'unanimité", () => {
    const item = buildItem({
      goldenBlockageTag: "pièce manquante",
      annotations: [
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
      ],
    });

    expect(unanimousFills(item)).toEqual([
      { axis: "procedureTag", tag: "rsa" },
    ]);
  });

  it("ne rend rien pour un item entièrement tranché", () => {
    const item = buildItem({
      goldenBlockageTag: "dossier bloqué",
      goldenProcedureTag: "rsa",
      annotations: [
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
      ],
    });

    expect(unanimousFills(item)).toEqual([]);
  });

  it("ne rend rien pour un item que personne n'a annoté", () => {
    expect(unanimousFills(buildItem())).toEqual([]);
  });

  it("ne rend rien pour un axe divergent", () => {
    const item = buildItem({
      annotations: [
        { blockageTag: "dossier bloqué", procedureTag: null },
        { blockageTag: "pièce manquante", procedureTag: null },
      ],
    });

    expect(unanimousFills(item)).toEqual([]);
  });
});
