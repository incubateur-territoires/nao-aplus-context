import { type AdjudicationItem } from "@/utils/golden-dataset-adjudication";
import { summarizeOverview } from "@/utils/golden-dataset-overview-summary";

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

const ADJUDICATED = buildItem({
  goldenBlockageTag: "dossier bloqué",
  goldenProcedureTag: "rsa",
  annotations: [{ blockageTag: "dossier bloqué", procedureTag: "rsa" }],
});

const UNANIMOUS = buildItem({
  annotations: [
    { blockageTag: "dossier bloqué", procedureTag: "rsa" },
    { blockageTag: "Dossier bloqué", procedureTag: "rsa" },
  ],
});

const TO_DISCUSS = buildItem({
  annotations: [
    { blockageTag: "dossier bloqué", procedureTag: "rsa" },
    { blockageTag: "pièce manquante", procedureTag: "cmu" },
  ],
});

describe("summarizeOverview", () => {
  it("compte les items des trois groupes", () => {
    const summary = summarizeOverview([
      ADJUDICATED,
      UNANIMOUS,
      TO_DISCUSS,
      TO_DISCUSS,
    ]);

    expect(summary.groups).toEqual({
      adjudicated: 1,
      unanimous: 1,
      toDiscuss: 2,
    });
  });

  it("rend les trois groupes à zéro sur un corpus vide", () => {
    expect(summarizeOverview([])).toEqual({
      groups: { adjudicated: 0, unanimous: 0, toDiscuss: 0 },
      pendingUnanimousAxes: 0,
    });
  });

  it("compte les axes en attente et non les items", () => {
    const item = buildItem({
      goldenProcedureTag: "rsa",
      annotations: [
        { blockageTag: "dossier bloqué", procedureTag: "cmu" },
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
      ],
    });

    expect(summarizeOverview([item]).pendingUnanimousAxes).toBe(1);
  });

  it("ne compte aucun axe en attente pour un item adjugé sur les deux axes", () => {
    expect(summarizeOverview([ADJUDICATED]).pendingUnanimousAxes).toBe(0);
  });

  it("somme les axes en attente de tout le corpus", () => {
    expect(
      summarizeOverview([UNANIMOUS, UNANIMOUS, TO_DISCUSS])
        .pendingUnanimousAxes,
    ).toBe(4);
  });
});
