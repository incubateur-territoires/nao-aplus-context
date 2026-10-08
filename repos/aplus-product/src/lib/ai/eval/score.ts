import { escapeRegExp } from "@/utils/escape-regexp";
import type {
  DetectionLayer,
  ExpectedPii,
  PiiCategory,
  PiiEvalCase,
} from "./pii-corpus";

/**
 * Mesure d'un caviardage : rappel et préservation du sens.
 *
 * Volontairement bête — il cherche des fragments, il ne devine rien. C'est au
 * corpus d'annoter au bon grain : un scorer malin serait un second système à
 * débugger, à l'endroit qui décide si le caviardage est sûr.
 */

/** En dessous, un fragment est trop court pour identifier qui que ce soit. */
const MIN_FRAGMENT_LENGTH = 2;

/**
 * Mots qui ne désignent personne à eux seuls. Sans cette liste, « Le Gall »
 * parfaitement caviardé compterait comme une fuite, parce que « le » subsiste
 * dans n'importe quelle phrase. Liste propre au scorer, et non celle du
 * pipeline : c'est une règle de mesure, pas un choix de caviardage.
 */
const NON_IDENTIFYING_WORDS = new Set([
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "et",
  "van",
  "von",
  "der",
  "den",
  "da",
  "di",
  "do",
  "dos",
  "das",
  "del",
  "della",
  "el",
  "al",
  "saint",
  "sainte",
  "st",
  "ste",
]);

/** En dessous, une suite de chiffres est trop banale pour être comparée telle quelle. */
const MIN_DIGIT_SEQUENCE = 4;

/**
 * Chiffres et séparateurs seulement. « 12 janvier 1984 » n'en est pas : comparée
 * sur « 121984 », elle passerait à tort pour caviardée.
 */
const NUMERIC_VALUE = /^[\d .\-/]+$/;

export interface MissedPii extends ExpectedPii {
  /** Fragments de la valeur encore lisibles dans le texte produit. */
  remaining: string[];
}

export interface CaseScore {
  case: string;
  expected: number;
  redacted: number;
  missed: MissedPii[];
  /** Fragments de `mustPreserve` détruits par le caviardage. */
  destroyed: string[];
}

export interface CategoryScore {
  category: PiiCategory;
  layer: DetectionLayer;
  expected: number;
  redacted: number;
  /** Part des PII de cette catégorie effectivement caviardées, entre 0 et 1. */
  recall: number;
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * « 06 12 34 56 78 » → « 0612345678 ». Deux nombres séparés par un mot restent
 * distincts, sinon des chiffres venus de deux endroits formeraient un faux match.
 */
function compactDigitGroups(text: string): string {
  return text.replace(/(\d)[ .\-/](?=\d)/g, "$1");
}

/** Retire les diacritiques, et la casse sauf si l'attente la rend signifiante. */
function fold(value: string, matchCase: boolean): string {
  const bare = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return matchCase ? bare : bare.toLocaleLowerCase();
}

function containsWord(
  text: string,
  token: string,
  matchCase: boolean,
): boolean {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(fold(token, matchCase))}(?![\\p{L}\\p{N}])`,
    "u",
  );
  return pattern.test(fold(text, matchCase));
}

/**
 * Fragments d'une PII encore présents ; tableau vide = correctement caviardée.
 * Les noms sont découpés en mots : en laisser un seul est un échec, pas un
 * demi-succès.
 */
export function remainingFragments(
  text: string,
  value: string,
  matchCase = false,
): string[] {
  const digits = digitsOf(value);
  if (NUMERIC_VALUE.test(value) && digits.length >= MIN_DIGIT_SEQUENCE) {
    return compactDigitGroups(text).includes(digits) ? [value] : [];
  }

  const fragments: string[] = [];
  const tokens = value.split(/\s+/);
  for (const token of tokens) {
    if (token.length < MIN_FRAGMENT_LENGTH) continue;
    // Une particule qui constitue à elle seule la valeur est le nom lui-même.
    if (tokens.length > 1 && NON_IDENTIFYING_WORDS.has(fold(token, false))) {
      continue;
    }
    // Comme le pipeline, une particule seule n'est un nom qu'avec sa majuscule.
    const particleName =
      tokens.length === 1 && NON_IDENTIFYING_WORDS.has(fold(token, false));
    if (containsWord(text, token, matchCase || particleName)) {
      fragments.push(token);
    }
  }
  return fragments;
}

export function scoreCase(evalCase: PiiEvalCase, produced: string): CaseScore {
  const missed: MissedPii[] = [];
  for (const expected of evalCase.mustRedact) {
    const remaining = remainingFragments(
      produced,
      expected.value,
      expected.matchCase ?? false,
    );
    if (remaining.length > 0) missed.push({ ...expected, remaining });
  }

  const destroyed = evalCase.mustPreserve.filter(
    (fragment) => !produced.includes(fragment),
  );

  return {
    case: evalCase.label,
    expected: evalCase.mustRedact.length,
    redacted: evalCase.mustRedact.length - missed.length,
    missed,
    destroyed,
  };
}

export function isMissed(
  score: CaseScore | undefined,
  expected: ExpectedPii,
): boolean {
  return (
    score?.missed.some(
      (entry) =>
        entry.category === expected.category && entry.value === expected.value,
    ) ?? false
  );
}

export interface ScoreTotals {
  expected: number;
  missed: number;
  destroyed: number;
}

export function summarizeScores(scores: CaseScore[]): ScoreTotals {
  return scores.reduce(
    (totals, score) => ({
      expected: totals.expected + score.expected,
      missed: totals.missed + score.missed.length,
      destroyed: totals.destroyed + score.destroyed.length,
    }),
    { expected: 0, missed: 0, destroyed: 0 },
  );
}

/**
 * Agrège les scores par catégorie de PII et par couche attendue, pour situer
 * les trous : un nom de citoyen mal orthographié n'est pas l'affaire de la couche A.
 */
export function scoreByCategory(
  cases: PiiEvalCase[],
  scores: CaseScore[],
): CategoryScore[] {
  const byCategory = new Map<string, CategoryScore>();

  for (const evalCase of cases) {
    const score = scores.find((entry) => entry.case === evalCase.label);
    for (const expected of evalCase.mustRedact) {
      const key = `${expected.category}:${expected.layer}`;
      const current = byCategory.get(key) ?? {
        category: expected.category,
        layer: expected.layer,
        expected: 0,
        redacted: 0,
        recall: 0,
      };
      current.expected += 1;
      if (!isMissed(score, expected)) current.redacted += 1;
      byCategory.set(key, current);
    }
  }

  return [...byCategory.values()]
    .map((entry) => ({
      ...entry,
      recall: entry.expected === 0 ? 1 : entry.redacted / entry.expected,
    }))
    .sort((a, b) => a.recall - b.recall);
}

export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/** Rapport lisible en console, pour le script d'éval. */
export function formatScoreReport(
  cases: PiiEvalCase[],
  scores: CaseScore[],
): string {
  const lines: string[] = [];
  const categories = scoreByCategory(cases, scores);

  lines.push("Rappel par catégorie de PII");
  lines.push(
    `  ${"catégorie".padEnd(20)}${"couche".padEnd(16)}${"caviardé".padStart(10)}${"rappel".padStart(9)}`,
  );
  for (const entry of categories) {
    lines.push(
      `  ${entry.category.padEnd(20)}${entry.layer.padEnd(16)}${`${entry.redacted}/${entry.expected}`.padStart(10)}${percent(entry.recall).padStart(9)}`,
    );
  }

  const missed = scores.flatMap((score) =>
    score.missed.map((entry) => ({ case: score.case, entry })),
  );
  lines.push("", `PII non caviardées : ${missed.length}`);
  for (const { case: label, entry } of missed) {
    lines.push(
      `  [${entry.category}] « ${entry.remaining.join(" ")} » — ${label}`,
    );
  }

  const destroyed = scores.flatMap((score) =>
    score.destroyed.map((fragment) => ({ case: score.case, fragment })),
  );
  lines.push("", `Fragments de sens détruits : ${destroyed.length}`);
  for (const { case: label, fragment } of destroyed) {
    lines.push(`  « ${fragment} » — ${label}`);
  }

  return lines.join("\n");
}
