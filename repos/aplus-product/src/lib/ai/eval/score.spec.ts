import {
  DETECTION_LAYERS,
  PII_CATEGORIES,
  type PiiEvalCase,
} from "./pii-corpus";
import {
  remainingFragments,
  scoreByCategory,
  scoreCase,
  summarizeScores,
} from "./score";

describe("remainingFragments", () => {
  it("compte un nom réduit à une particule", () => {
    expect(remainingFragments("M. Le a appelé.", "Le")).toEqual(["Le"]);
  });

  it("ne compte pas l'article homonyme d'un nom réduit à une particule", () => {
    expect(
      remainingFragments("Il a relancé la caisse de retraite.", "La"),
    ).toEqual([]);
  });

  it("ne renvoie rien quand la valeur a disparu", () => {
    expect(remainingFragments("Appeler [NUMERO_1].", "0612345678")).toEqual([]);
  });

  it("repère un numéro réécrit avec des séparateurs", () => {
    expect(remainingFragments("Appeler 06 12 34 56 78.", "0612345678")).toEqual(
      ["0612345678"],
    );
  });

  it("ne confond pas deux nombres éloignés avec la valeur cherchée", () => {
    expect(
      remainingFragments("Depuis 0612 et jusqu'à 345678.", "0612345678"),
    ).toEqual([]);
  });

  it("signale un nom caviardé à moitié", () => {
    expect(
      remainingFragments("[NOM_1] Lefèvre, Caf.", "Martine Lefèvre"),
    ).toEqual(["Lefèvre"]);
  });

  it("ignore la casse et les accents", () => {
    expect(remainingFragments("monsieur benali a écrit.", "Bénali")).toEqual([
      "Bénali",
    ]);
  });

  it("ne croit pas caviardée une date écrite en toutes lettres", () => {
    expect(
      remainingFragments(
        "Né le 12 janvier 1984, dossier bloqué.",
        "12 janvier 1984",
      ),
    ).toEqual(["12", "janvier", "1984"]);
  });

  it("distingue le nom de son homonyme quand la casse est signifiante", () => {
    const text = "[NOM_1] conteste : un petit reste à charge subsiste.";
    expect(remainingFragments(text, "Petit", true)).toEqual([]);
    expect(remainingFragments(text, "Petit")).toEqual(["Petit"]);
  });

  it.each([
    "Le Gall",
    "de la Fontaine",
    "Da Silva",
    "Van der Berg",
    "Saint Aubin",
  ])("ne compte pas la particule de « %s » comme une fuite", (name) => {
    const text =
      "[NOM_1] a écrit : le dossier de la famille est clos, saint et sauf.";
    expect(remainingFragments(text, name)).toEqual([]);
  });

  it("signale encore la partie identifiante d'un nom à particule", () => {
    expect(remainingFragments("Mme Gall a relancé.", "Le Gall")).toEqual([
      "Gall",
    ]);
  });

  it("exige une frontière de mot", () => {
    expect(remainingFragments("Le benalisme n'existe pas.", "Benali")).toEqual(
      [],
    );
  });
});

describe("scoreCase", () => {
  const evalCase: PiiEvalCase = {
    label: "cas de test",
    text: "Karim Benali, 0612345678, RSA de 600 euros.",
    mustRedact: [
      {
        category: PII_CATEGORIES.CITIZEN_NAME,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "Karim Benali",
      },
      {
        category: PII_CATEGORIES.PHONE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "0612345678",
      },
    ],
    mustPreserve: ["RSA de 600 euros"],
  };

  it("compte les PII caviardées et celles qui restent", () => {
    const score = scoreCase(
      evalCase,
      "[NOM_1] [NOM_2], 0612345678, RSA de 600 euros.",
    );
    expect(score.expected).toBe(2);
    expect(score.redacted).toBe(1);
    expect(score.missed).toHaveLength(1);
    expect(score.missed[0].category).toBe(PII_CATEGORIES.PHONE);
  });

  it("signale un fragment de sens détruit", () => {
    const score = scoreCase(
      evalCase,
      "[NOM_1] [NOM_2], [NUMERO_1], RSA de [NUMERO_2] euros.",
    );
    expect(score.missed).toHaveLength(0);
    expect(score.destroyed).toEqual(["RSA de 600 euros"]);
  });
});

describe("scoreByCategory", () => {
  it("agrège le rappel par catégorie et trie les plus mauvaises d'abord", () => {
    const cases: PiiEvalCase[] = [
      {
        label: "a",
        text: "",
        mustRedact: [
          {
            category: PII_CATEGORIES.PHONE,
            layer: DETECTION_LAYERS.DETERMINISTIC,
            value: "0612345678",
          },
        ],
        mustPreserve: [],
      },
      {
        label: "b",
        text: "",
        mustRedact: [
          {
            category: PII_CATEGORIES.EMAIL,
            layer: DETECTION_LAYERS.DETERMINISTIC,
            value: "a@example.org",
          },
        ],
        mustPreserve: [],
      },
    ];
    const scores = [
      scoreCase(cases[0], "[NUMERO_1]"),
      scoreCase(cases[1], "a@example.org"),
    ];

    const result = scoreByCategory(cases, scores);
    expect(result[0]).toMatchObject({
      category: PII_CATEGORIES.EMAIL,
      recall: 0,
    });
    expect(result[1]).toMatchObject({
      category: PII_CATEGORIES.PHONE,
      recall: 1,
    });
  });

  it("sépare une même catégorie attendue de deux couches différentes", () => {
    const evalCase: PiiEvalCase = {
      label: "c",
      text: "",
      mustRedact: [
        {
          category: PII_CATEGORIES.CITIZEN_NAME,
          layer: DETECTION_LAYERS.DETERMINISTIC,
          value: "Benaissa",
        },
        {
          category: PII_CATEGORIES.CITIZEN_NAME,
          layer: DETECTION_LAYERS.LLM,
          value: "Bennaissa",
        },
      ],
      mustPreserve: [],
    };

    const result = scoreByCategory(
      [evalCase],
      [scoreCase(evalCase, "[NOM_1], écrit aussi Bennaissa.")],
    );
    expect(result).toEqual([
      expect.objectContaining({ layer: DETECTION_LAYERS.LLM, recall: 0 }),
      expect.objectContaining({
        layer: DETECTION_LAYERS.DETERMINISTIC,
        recall: 1,
      }),
    ]);
  });
});

describe("summarizeScores", () => {
  it("additionne attentes, fuites et fragments détruits", () => {
    const evalCase: PiiEvalCase = {
      label: "d",
      text: "",
      mustRedact: [
        {
          category: PII_CATEGORIES.PHONE,
          layer: DETECTION_LAYERS.DETERMINISTIC,
          value: "0612345678",
        },
      ],
      mustPreserve: ["RSA suspendu"],
    };

    expect(
      summarizeScores([
        scoreCase(evalCase, "0612345678"),
        scoreCase(evalCase, "[NUMERO_1], RSA suspendu"),
      ]),
    ).toEqual({ expected: 2, missed: 1, destroyed: 1 });
  });
});
