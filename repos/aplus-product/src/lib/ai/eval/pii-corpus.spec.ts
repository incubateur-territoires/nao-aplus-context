import {
  DETECTION_LAYERS,
  KNOWN_DETERMINISTIC_GAPS,
  KNOWN_OVER_REDACTIONS,
  PII_EVAL_CASES,
  type PiiEvalCase,
} from "./pii-corpus";
import { redactWithLayerA } from "./run-redaction";
import { scoreCase } from "./score";

/** Couche A sur le corpus, sans réseau. La couche B se mesure via `redaction:eval`. */

function isKnownGap(evalCase: PiiEvalCase, value: string): boolean {
  return KNOWN_DETERMINISTIC_GAPS.some(
    (gap) => gap.case === evalCase.label && gap.value === value,
  );
}

describe("corpus d'éval — intégrité", () => {
  it("ne contient aucun label en double", () => {
    const labels = PII_EVAL_CASES.map((evalCase) => evalCase.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(PII_EVAL_CASES)(
    "« $label » : les valeurs annotées figurent bien dans le texte",
    (evalCase) => {
      for (const expected of evalCase.mustRedact) {
        expect(evalCase.text).toContain(expected.value);
      }
      for (const fragment of evalCase.mustPreserve) {
        expect(evalCase.text).toContain(fragment);
      }
    },
  );

  it("ne référence que des cas existants dans les trous connus", () => {
    for (const gap of KNOWN_DETERMINISTIC_GAPS) {
      const evalCase = PII_EVAL_CASES.find((entry) => entry.label === gap.case);
      expect(evalCase).toBeDefined();
      expect(
        evalCase?.mustRedact.some((expected) => expected.value === gap.value),
      ).toBe(true);
    }
    for (const entry of KNOWN_OVER_REDACTIONS) {
      const evalCase = PII_EVAL_CASES.find((item) => item.label === entry.case);
      expect(evalCase).toBeDefined();
      expect(evalCase?.mustPreserve).toContain(entry.fragment);
    }
  });
});

function isKnownOverRedaction(
  evalCase: PiiEvalCase,
  fragment: string,
): boolean {
  return KNOWN_OVER_REDACTIONS.some(
    (entry) => entry.case === evalCase.label && entry.fragment === fragment,
  );
}

describe("couche A — préservation du sens", () => {
  it.each(PII_EVAL_CASES)(
    "« $label » : ne détruit aucun fragment porteur de sens",
    (evalCase) => {
      const destroyed = scoreCase(
        evalCase,
        redactWithLayerA(evalCase).text,
      ).destroyed.filter(
        (fragment) => !isKnownOverRedaction(evalCase, fragment),
      );
      expect(destroyed).toEqual([]);
    },
  );
});

describe("couche A — rappel sur ce qu'elle doit attraper", () => {
  const deterministicCases = PII_EVAL_CASES.filter((evalCase) =>
    evalCase.mustRedact.some(
      (expected) =>
        expected.layer === DETECTION_LAYERS.DETERMINISTIC &&
        !isKnownGap(evalCase, expected.value),
    ),
  );

  it.each(deterministicCases)("« $label »", (evalCase) => {
    const missed = scoreCase(evalCase, redactWithLayerA(evalCase).text)
      .missed.filter(
        (entry) =>
          entry.layer === DETECTION_LAYERS.DETERMINISTIC &&
          !isKnownGap(evalCase, entry.value),
      )
      .map((entry) => `${entry.category} : ${entry.remaining.join(" ")}`);

    expect(missed).toEqual([]);
  });
});

/** Pendant des tests précédents : un trou comblé rougit ici et nomme la ligne à retirer. */
describe("couche A — la dette déclarée est encore réelle", () => {
  it("chaque trou de rappel laisse encore passer sa valeur", () => {
    const closed = KNOWN_DETERMINISTIC_GAPS.filter((gap) => {
      const evalCase = PII_EVAL_CASES.find((entry) => entry.label === gap.case);
      if (!evalCase) throw new Error(`cas introuvable : ${gap.case}`);
      const score = scoreCase(evalCase, redactWithLayerA(evalCase).text);
      return !score.missed.some((entry) => entry.value === gap.value);
    });

    expect(closed.map((gap) => `${gap.case} → ${gap.value}`)).toEqual([]);
  });

  it("chaque sur-caviardage déclaré détruit encore son fragment", () => {
    const fixed = KNOWN_OVER_REDACTIONS.filter((entry) => {
      const evalCase = PII_EVAL_CASES.find((item) => item.label === entry.case);
      if (!evalCase) throw new Error(`cas introuvable : ${entry.case}`);
      const score = scoreCase(evalCase, redactWithLayerA(evalCase).text);
      return !score.destroyed.includes(entry.fragment);
    });

    expect(fixed.map((entry) => `${entry.case} → ${entry.fragment}`)).toEqual(
      [],
    );
  });
});
