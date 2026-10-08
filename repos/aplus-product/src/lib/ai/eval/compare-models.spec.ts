import { createUsageTotals } from "../usage";
import {
  formatModelComparison,
  hasFailed,
  type ModelRun,
} from "./compare-models";
import {
  DETECTION_LAYERS,
  PII_CATEGORIES,
  type PiiEvalCase,
} from "./pii-corpus";
import { scoreCase } from "./score";

const CASES: PiiEvalCase[] = [
  {
    label: "tiers",
    text: "Sa cousine Nadia l'héberge, la CAF demande une attestation.",
    mustRedact: [
      {
        category: PII_CATEGORIES.THIRD_PARTY_NAME,
        layer: DETECTION_LAYERS.LLM,
        value: "Nadia",
      },
    ],
    mustPreserve: ["la CAF demande une attestation"],
  },
  {
    label: "numéro",
    text: "Joignable au 0612345678.",
    mustRedact: [
      {
        category: PII_CATEGORIES.PHONE,
        layer: DETECTION_LAYERS.DETERMINISTIC,
        value: "0612345678",
      },
    ],
    mustPreserve: [],
  },
];

function run(
  model: string,
  outputs: [string, string],
  refused: string[] = [],
): ModelRun {
  return {
    model,
    scores: CASES.map((evalCase, index) => scoreCase(evalCase, outputs[index])),
    refused,
    usage: { ...createUsageTotals(), calls: 4, latencyMs: 2000 },
  };
}

const CLEAN = run("modele-sur", [
  "Sa cousine [NOM_1] l'héberge, la CAF demande une attestation.",
  "Joignable au [NUMERO_1].",
]);

const LEAKY = run(
  "modele-fuyant",
  [
    "Sa cousine Nadia l'héberge, la [NOM_1] demande une attestation.",
    "Joignable au [NUMERO_1].",
  ],
  ["tiers"],
);

describe("hasFailed", () => {
  it("accepte un run sans fuite, sans sens détruit ni refus", () => {
    expect(hasFailed(CLEAN)).toBe(false);
  });

  it("échoue sur un refus du juge, même sans fuite", () => {
    expect(hasFailed({ ...CLEAN, refused: ["numéro"] })).toBe(true);
  });

  it("échoue sur une fuite ou un fragment détruit", () => {
    expect(hasFailed(LEAKY)).toBe(true);
  });
});

describe("formatModelComparison", () => {
  const report = formatModelComparison(CASES, [CLEAN, LEAKY]);

  it("nomme chaque colonne par son modèle", () => {
    expect(report).toContain("M1 = modele-sur");
    expect(report).toContain("M2 = modele-fuyant");
  });

  it("met côte à côte le rappel restreint aux PII dépendant du LLM", () => {
    expect(report).toMatch(
      /rappel sur les PII dépendant du LLM\s+1\/1 100 %\s+0\/1 0 %/,
    );
  });

  it("liste la fuite et le fragment détruit sous le modèle fautif", () => {
    expect(report).toContain(
      "ok      FUITE   [THIRD_PARTY_NAME] Nadia · tiers",
    );
    expect(report).toContain(
      "ok      DÉTRUIT « la CAF demande une attestation » · tiers",
    );
    expect(report).toContain("ok      REFUS   tiers");
  });

  it("n'affiche pas les PII que tous les modèles ont caviardées", () => {
    expect(report).not.toContain("0612345678");
  });

  it("donne la latence moyenne par appel et le verdict", () => {
    expect(report).toMatch(/latence moyenne par appel\s+500 ms\s+500 ms/);
    expect(report).toMatch(/verdict\s+ok\s+ÉCHEC/);
  });
});
