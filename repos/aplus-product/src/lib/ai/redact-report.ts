import {
  PII_TYPES,
  type CitizenIdentity,
  type GuardResult,
  type GuardViolation,
  type PiiMatch,
} from "@/types/ai-pipeline";
import { checkNoPii } from "./guards/no-pii";
import {
  pseudonymizeFields,
  redactLiterals,
  redactNamesInFields,
  type NamedField,
} from "./pseudonymize";
import { extractNamesStep } from "./steps/extract-names";
import { judgePiiStep } from "./steps/judge-pii";

/**
 * Caviardage d'un dossier complet — signalement et fil d'échanges — destiné à
 * remplacer le faux texte écrit à la suppression. Le sens du dossier doit
 * survivre, les personnes non.
 *
 * Trois passes, dans cet ordre : couche A déterministe, couche B (le LLM
 * désigne les noms de tiers, le code les retire), puis un juge adverse sur le
 * résultat. Le LLM ne réécrit jamais le texte à aucune étape.
 *
 * Deux modes d'échec, volontairement distincts pour l'appelant : une panne
 * d'API remonte en exception, un caviardage impossible revient avec
 * `guard.ok === false`. C'est le juge qui porte ce refus : des résidus cités
 * après le dernier caviardage ne sont pas corrigés à l'aveugle.
 */

const SUBJECT_KEY = "subject";
const DESCRIPTION_KEY = "description";
const ANSWER_PREFIX = "answer:";

/**
 * Taille maximale d'un texte soumis en un appel. Au-delà, le dossier est
 * découpé : les noms trouvés sont ensuite appliqués à TOUT le dossier de façon
 * déterministe, donc le découpage ne casse aucune cohérence de jetons.
 */
const MAX_PROMPT_CHARS = 12_000;

/**
 * Passages du juge qui caviardent ce qu'il cite. Le juge n'est pas déterministe
 * et découvre parfois au second passage ce qu'il a manqué au premier. Si le
 * dernier passage a encore caviardé, un passage de plus vérifie sans rien
 * corriger : ce qu'il cite alors vaut refus. Dans le cas courant (juge muet
 * d'emblée) il n'y a qu'un seul appel.
 */
const MAX_JUDGE_ROUNDS = 2;

export interface ReportAnswerInput {
  id: string;
  content: string;
}

export interface ReportRedactionInput {
  subject: string;
  description: string;
  answers: ReportAnswerInput[];
  identity: CitizenIdentity;
  /** Noms des auteurs du signalement et des réponses, connus en base. */
  participantNames: string[];
}

export interface ReportRedactionOutput {
  subject: string;
  description: string;
  answers: ReportAnswerInput[];
  matches: PiiMatch[];
  guard: GuardResult;
}

function toFields(input: ReportRedactionInput): NamedField[] {
  return [
    { key: SUBJECT_KEY, text: input.subject },
    { key: DESCRIPTION_KEY, text: input.description },
    ...input.answers.map((answer) => ({
      key: `${ANSWER_PREFIX}${answer.id}`,
      text: answer.content,
    })),
  ];
}

/** Un champ trop long pour un appel est coupé au dernier blanc avant la limite. */
function splitLongText(text: string): string[] {
  const parts: string[] = [];
  let rest = text;

  while (rest.length > MAX_PROMPT_CHARS) {
    const window = rest.slice(0, MAX_PROMPT_CHARS);
    const upToLastBlank = window.match(/^[\s\S]*\s/)?.[0].length;
    const cut = upToLastBlank ?? MAX_PROMPT_CHARS;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }

  if (rest) parts.push(rest);
  return parts;
}

/** Découpe sur les frontières de champ : un message n'est coupé que s'il dépasse seul la limite. */
function toChunks(fields: NamedField[]): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const text of fields.flatMap((field) => splitLongText(field.text))) {
    const candidate = current ? `${current}\n\n${text}` : text;
    if (current && candidate.length > MAX_PROMPT_CHARS) {
      chunks.push(current);
      current = text;
      continue;
    }
    current = candidate;
  }

  if (current) chunks.push(current);
  return chunks;
}

async function extractNames(fields: NamedField[]): Promise<string[]> {
  const names = new Set<string>();

  for (const chunk of toChunks(fields)) {
    const output = await extractNamesStep.run({
      subject: "",
      description: chunk,
    });
    output.names.forEach((name) => names.add(name));
  }

  return [...names];
}

async function judge(fields: NamedField[]): Promise<string[]> {
  const residues = new Set<string>();

  for (const chunk of toChunks(fields)) {
    const output = await judgePiiStep.run({ text: chunk });
    output.residues.forEach((residue) => residues.add(residue));
  }

  return [...residues];
}

function countMatches(matches: PiiMatch[], type: PiiMatch["type"]): number {
  return matches.filter((match) => match.type === type).length;
}

export async function redactReport(
  input: ReportRedactionInput,
): Promise<ReportRedactionOutput> {
  const layerA = pseudonymizeFields(
    toFields(input),
    input.identity,
    input.participantNames,
  );

  const names = await extractNames(layerA.fields);
  const layerB = redactNamesInFields(
    layerA.fields,
    names,
    countMatches(layerA.matches, PII_TYPES.NAME),
  );

  let fields = layerB.fields;
  const matches = [...layerA.matches, ...layerB.matches];
  const violations: GuardViolation[] = [];

  for (let round = 0; round <= MAX_JUDGE_ROUNDS; round++) {
    const residues = await judge(fields);
    if (residues.length === 0) break;
    if (round === MAX_JUDGE_ROUNDS) {
      violations.push(
        ...residues.map((value) => ({ type: PII_TYPES.RESIDUAL, value })),
      );
      break;
    }

    const corrected = redactLiterals(
      fields,
      residues,
      countMatches(matches, PII_TYPES.RESIDUAL),
    );
    fields = corrected.fields;
    matches.push(...corrected.matches);
  }

  // La couche A ne doit plus rien trouver dans sa propre sortie. Les jetons ne
  // sont pas détectés et passent sans bruit.
  for (const field of fields) {
    const check = checkNoPii(field.text, input.identity, names);
    violations.push(...check.violations);
  }

  const byKey = new Map(fields.map((field) => [field.key, field.text]));

  return {
    subject: byKey.get(SUBJECT_KEY) ?? "",
    description: byKey.get(DESCRIPTION_KEY) ?? "",
    answers: input.answers.map((answer) => ({
      id: answer.id,
      content: byKey.get(`${ANSWER_PREFIX}${answer.id}`) ?? "",
    })),
    matches,
    guard: { ok: violations.length === 0, violations },
  };
}
