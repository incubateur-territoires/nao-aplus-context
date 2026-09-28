import type { GoldenSplit } from "./golden-dataset-split";
import {
  OTHER_DEFINITION,
  UNDETERMINED_DEFINITION,
  type ClosedTaxonomy,
} from "./golden-dataset-taxonomy";
import {
  OFF_LIST,
  scoreRun,
  wilson,
  type RunMode,
  type ScoringItem,
  type ScoringPrediction,
  type TagScore,
} from "./golden-dataset-scoring";

function axisTag(tag: string) {
  return { tag, definition: `Définition de ${tag}.`, examples: [] };
}

const TAXONOMY: ClosedTaxonomy = {
  version: 1,
  axes: {
    blockageTag: [
      axisTag("retard"),
      axisTag("bug"),
      OTHER_DEFINITION,
      UNDETERMINED_DEFINITION,
    ],
    procedureTag: [axisTag("RSA"), OTHER_DEFINITION, UNDETERMINED_DEFINITION],
  },
  projection: {
    blockageTag: [
      ["retard dossier", "retard"],
      ["lenteur", "retard"],
      ["panne", "bug"],
      ["inconnu", "inconnu"],
    ],
    procedureTag: [
      ["demande rsa", "RSA"],
      ["inconnu", "inconnu"],
    ],
  },
};

const FREE: RunMode = { kind: "free" };
const CLOSED: RunMode = { kind: "closed" };
const FINE: RunMode = { kind: "fine" };

interface ItemSpec {
  id: string;
  split?: GoldenSplit;
  blockage: string | null;
  closedBlockage?: string;
  annotators?: string[];
}

function item({
  id,
  split = "tuning",
  blockage,
  closedBlockage,
  annotators = [],
}: ItemSpec): ScoringItem {
  return {
    id,
    split,
    fineGolds: { blockageTag: blockage, procedureTag: "demande rsa" },
    closedGolds:
      closedBlockage === undefined
        ? null
        : { blockageTag: closedBlockage, procedureTag: "RSA" },
    annotatorTags: { blockageTag: annotators, procedureTag: ["demande rsa"] },
  };
}

function predict(
  itemId: string,
  blockageTag: string | null,
  procedureTag: string | null = "demande rsa",
): ScoringPrediction {
  return { itemId, blockageTag, procedureTag };
}

function tagScore(scores: readonly TagScore[], tag: string): TagScore {
  const score = scores.find((entry) => entry.tag === tag);
  if (score === undefined) throw new Error(`tag absent : ${tag}`);
  return score;
}

describe("wilson", () => {
  it("rend l'intervalle de Wilson à 95 %", () => {
    const proportion = wilson(7, 10);

    expect(proportion?.rate).toBe(0.7);
    expect(proportion?.low).toBeCloseTo(0.3968, 3);
    expect(proportion?.high).toBeCloseTo(0.8922, 3);
  });

  it("reste dans [0, 1] aux extrêmes", () => {
    expect(wilson(0, 5)?.low).toBe(0);
    expect(wilson(5, 5)?.high).toBeLessThanOrEqual(1);
  });

  it("ne calcule rien sans item", () => {
    expect(wilson(0, 0)).toBeNull();
  });
});

describe("scoreRun en texte libre", () => {
  const items = [
    item({ id: "a", blockage: "retard dossier", closedBlockage: "retard" }),
    item({ id: "b", blockage: "panne", closedBlockage: "bug" }),
    item({ id: "c", blockage: "lenteur", closedBlockage: "retard" }),
    item({ id: "d", blockage: "panne", closedBlockage: "bug" }),
  ];

  it("compare les libellés fins à l'égalité canonique près", () => {
    const scores = scoreRun(
      items,
      [
        predict("a", "Retard  Dossier"),
        predict("b", "panne"),
        predict("c", "retard dossier"),
        predict("d", "écran figé"),
      ],
      FREE,
      TAXONOMY,
    );

    const strict = scores.tuning.axes.blockageTag.fine?.strict;
    expect(strict?.correct).toBe(2);
    expect(strict?.n).toBe(4);
  });

  it("projette le libellé prédit et compte faux un libellé inconnu de la projection", () => {
    const scores = scoreRun(
      items,
      [
        predict("a", "retard dossier"),
        predict("b", "panne"),
        predict("c", "retard dossier"),
        predict("d", "écran figé"),
      ],
      FREE,
      TAXONOMY,
    );

    const closed = scores.tuning.axes.blockageTag.closed;
    expect(closed.strict?.correct).toBe(3);
    expect(closed.confusions).toEqual([
      { gold: "bug", predicted: OFF_LIST, count: 1 },
    ]);
  });

  it("compte à part les items sans prédiction", () => {
    const scores = scoreRun(
      items,
      [predict("a", "retard dossier")],
      FREE,
      TAXONOMY,
    );

    expect(scores.tuning.items).toBe(4);
    expect(scores.tuning.predicted).toBe(1);
    expect(scores.tuning.axes.blockageTag.fine?.strict?.n).toBe(1);
    expect(scores.tuning.axes.blockageTag.closed.strict?.n).toBe(1);
  });

  it("ne calcule pas de score fermé sans gold figé", () => {
    const scores = scoreRun(
      [item({ id: "x", blockage: "panne" })],
      [predict("x", "panne")],
      FREE,
      TAXONOMY,
    );

    expect(scores.tuning.axes.blockageTag.closed.strict).toBeNull();
    expect(scores.tuning.axes.blockageTag.fine?.strict?.correct).toBe(1);
  });
});

describe("exutoires en labels fins", () => {
  it("reconnaît « autre » et « aucun » répondus tels quels", () => {
    const taxonomy: ClosedTaxonomy = {
      ...TAXONOMY,
      axes: {
        ...TAXONOMY.axes,
        blockageTag: [...TAXONOMY.axes.blockageTag, axisTag("aucun")],
      },
    };
    const scores = scoreRun(
      [
        item({ id: "a", blockage: "panne", closedBlockage: "autre" }),
        item({ id: "b", blockage: "panne", closedBlockage: "aucun" }),
      ],
      [predict("a", "Autre"), predict("b", "aucun")],
      FINE,
      taxonomy,
    );

    expect(scores.tuning.axes.blockageTag.closed.strict?.correct).toBe(2);
    expect(scores.tuning.axes.blockageTag.closed.confusions).toEqual([]);
  });
});

describe("exactitude indulgente", () => {
  it("compte juste une prédiction qui rejoint un annotateur, canonicalisé des deux côtés", () => {
    const scores = scoreRun(
      [
        item({
          id: "a",
          blockage: "retard dossier",
          annotators: ["Lenteur ", "retard dossier"],
        }),
        item({ id: "b", blockage: "panne", annotators: ["panne"] }),
        item({ id: "c", blockage: "panne" }),
      ],
      [predict("a", "lenteur"), predict("b", "retard"), predict("c", "panne")],
      FREE,
      TAXONOMY,
    );

    const fine = scores.tuning.axes.blockageTag.fine;
    expect(fine?.strict?.correct).toBe(1);
    expect(fine?.lenient).toMatchObject({ correct: 2, n: 3 });
  });

  it("n'est jamais plus sévère que l'exactitude stricte", () => {
    const scores = scoreRun(
      [item({ id: "a", blockage: "retard dossier", annotators: ["lenteur"] })],
      [predict("a", "retard dossier")],
      FINE,
      TAXONOMY,
    );

    const fine = scores.tuning.axes.blockageTag.fine;
    expect(fine?.strict?.correct).toBe(1);
    expect(fine?.lenient?.correct).toBe(1);
  });
});

describe("scoreRun en liste fermée", () => {
  const items = [
    item({ id: "a", blockage: "lenteur", closedBlockage: "retard" }),
    item({ id: "b", blockage: "panne", closedBlockage: "bug" }),
  ];

  it("ne produit pas de score fin", () => {
    const scores = scoreRun(
      items,
      [predict("a", "retard", "rsa"), predict("b", "bug", "RSA")],
      CLOSED,
      TAXONOMY,
    );

    expect(scores.tuning.axes.blockageTag.fine).toBeNull();
    expect(scores.tuning.axes.procedureTag.closed.strict?.correct).toBe(2);
  });

  it("compte faux un tag hors liste", () => {
    const scores = scoreRun(
      items,
      [predict("a", "retard"), predict("b", "lenteur")],
      CLOSED,
      TAXONOMY,
    );

    expect(scores.tuning.axes.blockageTag.closed.strict?.correct).toBe(1);
    expect(scores.tuning.axes.blockageTag.closed.confusions).toEqual([
      { gold: "bug", predicted: OFF_LIST, count: 1 },
    ]);
  });
});

describe("scoreRun en labels fins", () => {
  it("déduit le tag fermé du libellé par la projection", () => {
    const scores = scoreRun(
      [item({ id: "a", blockage: "retard dossier", closedBlockage: "retard" })],
      [predict("a", "lenteur")],
      FINE,
      TAXONOMY,
    );

    const axis = scores.tuning.axes.blockageTag;
    expect(axis.fine?.strict?.correct).toBe(0);
    expect(axis.closed.strict?.correct).toBe(1);
  });
});

describe("scores par tag et confusions", () => {
  const items = [
    ...["r1", "r2", "r3", "r4"].map((id) =>
      item({ id, blockage: "lenteur", closedBlockage: "retard" }),
    ),
    item({ id: "b1", blockage: "panne", closedBlockage: "bug" }),
    item({ id: "b2", blockage: "panne", closedBlockage: "bug" }),
  ];
  const scores = scoreRun(
    items,
    [
      predict("r1", "lenteur"),
      predict("r2", "lenteur"),
      predict("r3", "panne"),
      predict("r4", "panne"),
      predict("b1", "lenteur"),
      predict("b2", "panne"),
    ],
    FREE,
    TAXONOMY,
  );
  const closed = scores.tuning.axes.blockageTag.closed;

  it("calcule précision, rappel et F1 au-dessus du seuil", () => {
    expect(tagScore(closed.perTag, "retard")).toEqual({
      kind: "scored",
      tag: "retard",
      support: 4,
      precision: 2 / 3,
      recall: 0.5,
      f1: (2 * (2 / 3) * 0.5) / (2 / 3 + 0.5),
    });
  });

  it("ne calcule rien sous MIN_ITEMS_PER_TAG", () => {
    expect(tagScore(closed.perTag, "bug")).toEqual({
      kind: "belowMinimum",
      tag: "bug",
      support: 2,
    });
  });

  it("classe les confusions de la plus fréquente à la plus rare", () => {
    expect(closed.confusions).toEqual([
      { gold: "retard", predicted: "bug", count: 2 },
      { gold: "bug", predicted: "retard", count: 1 },
    ]);
  });
});

describe("abstention", () => {
  it("compte les « inconnu » prédits et ceux qui tombent sur un gold « inconnu »", () => {
    const scores = scoreRun(
      [
        item({ id: "a", blockage: "inconnu", closedBlockage: "inconnu" }),
        item({ id: "b", blockage: "panne", closedBlockage: "bug" }),
        item({ id: "c", blockage: "inconnu", closedBlockage: "inconnu" }),
      ],
      [predict("a", null), predict("b", null), predict("c", "panne")],
      CLOSED,
      TAXONOMY,
    );

    const axis = scores.tuning.axes.blockageTag;
    expect(axis.abstention).toEqual({
      predicted: 3,
      abstained: 2,
      goldUndetermined: 2,
      abstainedOnGoldUndetermined: 1,
    });
    expect(axis.closed.strict?.correct).toBe(1);
  });
});

describe("sous-ensembles", () => {
  it("sépare mise au point et examen", () => {
    const scores = scoreRun(
      [
        item({ id: "a", blockage: "panne", closedBlockage: "bug" }),
        item({
          id: "b",
          split: "test",
          blockage: "panne",
          closedBlockage: "bug",
        }),
        item({
          id: "c",
          split: "test",
          blockage: "panne",
          closedBlockage: "bug",
        }),
      ],
      [predict("a", "panne"), predict("b", "lenteur"), predict("c", "panne")],
      FREE,
      TAXONOMY,
    );

    expect(scores.tuning.axes.blockageTag.closed.strict).toMatchObject({
      correct: 1,
      n: 1,
    });
    expect(scores.test.axes.blockageTag.closed.strict).toMatchObject({
      correct: 1,
      n: 2,
    });
  });
});
