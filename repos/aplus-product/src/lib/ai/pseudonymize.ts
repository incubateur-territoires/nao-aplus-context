import { escapeRegExp } from "@/utils/escape-regexp";
import { EMAIL_PATTERN } from "@/utils/redact";
import {
  PII_TYPES,
  type CitizenIdentity,
  type PiiMatch,
  type PiiType,
  type PipelineInput,
  type PseudonymizationResult,
} from "@/types/ai-pipeline";

/**
 * Couche A de pseudonymisation : caviardage déterministe du texte libre d'un
 * signalement. Tourne en local, sans aucun appel réseau ni clé API.
 *
 * Deux familles de PII sont traitées :
 *  1. Ce qui se reconnaît à un motif fixe : suites longues de chiffres (NIR,
 *     NIF, CAF, téléphone…), adresses e-mail, références de dossier. Le seuil
 *     du détecteur numérique PRÉSERVE les chiffres courts porteurs de sens
 *     (durée, montant, année, nombre d'enfants) dont le résumé a besoin.
 *  2. Ce qui est connu en base : noms des personnes (citoyen, participants au
 *     fil) et date de naissance. Retiré par dictionnaire, donc sans NER.
 *
 * Les noms de tiers cités en texte libre — un proche, un employeur — ne sont
 * PAS couverts ici : ils relèvent de l'étape LLM de pseudonymisation.
 *
 * Chaque valeur détectée est remplacée par un jeton stable : la même valeur
 * reçoit toujours le même jeton, pour préserver la cohérence du texte transmis
 * aux étapes LLM.
 */

const PLACEHOLDER_LABELS: Record<PiiType, string> = {
  [PII_TYPES.NUMBER]: "NUMERO",
  [PII_TYPES.NAME]: "NOM",
  [PII_TYPES.EMAIL]: "EMAIL",
  [PII_TYPES.BIRTH_DATE]: "DATE_NAISSANCE",
  [PII_TYPES.CASE_NUMBER]: "DOSSIER",
  [PII_TYPES.RESIDUAL]: "DONNEE",
};

/**
 * Suite d'au moins 7 chiffres, séparateurs espace/point/tiret tolérés.
 * Seuil à 7 : c'est la longueur du plus court identifiant du modèle (CAF) ;
 * en dessous on reste sur des nombres porteurs de sens (montants, années…).
 *
 * Limite assumée : un grand nombre groupé par espaces (« 1 500 000 ») peut être
 * caviardé à tort. Rare dans ce domaine, et on préfère sur-caviarder un montant
 * que laisser fuiter un identifiant.
 */
const NUMBER_REGEX = /\d(?:[ .-]?\d){6,}/g;

/**
 * Référence de dossier : 1 à 3 lettres capitales collées à au moins 5 chiffres.
 * Collées volontairement — tolérer un espace ferait de « RSA 123456 » une
 * référence et mangerait le sigle, qui porte du sens.
 */
const CASE_NUMBER_REGEX = /\b[A-Z]{1,3}\d{5,}\b/g;

/** Longueur minimale d'un fragment de nom pris en compte dans le dictionnaire. */
const MIN_NAME_TOKEN_LENGTH = 2;

/**
 * Particules et articles écartés du dictionnaire EN TANT QUE fragment isolé.
 * Sans cette liste, un agent nommé « Marc de Vaucelles » fait disparaître tous
 * les « de » du signalement. La valeur entière reste un détecteur à part, et les
 * détecteurs sont ordonnés du plus long au plus court : le nom complet part
 * d'un bloc.
 */
const NAME_PARTICLES = new Set([
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "van",
  "von",
  "der",
  "den",
  "da",
  "di",
  "dos",
  "das",
  "el",
  "al",
  "ben",
  "bin",
  "ibn",
  "mac",
  "mc",
  "saint",
  "sainte",
  "st",
  "ste",
]);

/**
 * Noms de famille qui sont aussi des mots courants. Pour ceux-là seulement, le
 * caviardage exige une majuscule initiale : « Petit » est un nom, « petit » un
 * adjectif. Limite assumée — un nom écrit tout en minuscules échappe au
 * dictionnaire, et un mot courant en début de phrase est caviardé à tort.
 */
const COMMON_WORD_NAMES = new Set([
  "petit",
  "grand",
  "blanc",
  "brun",
  "roux",
  "fort",
  "bon",
  "jeune",
  "rose",
  "olivier",
  "pierre",
  "prince",
  "roy",
  "berger",
  "marchand",
  "boulanger",
  "charpentier",
  "meunier",
  "mercier",
  "chevalier",
  "jardin",
  "moulin",
  "pont",
  "champ",
  "bois",
  "roche",
  "mont",
  "val",
  "riviere",
  "fontaine",
  "lemoine",
]);

/** Variantes accentuées par lettre de base, pour un matching tolérant. */
const DIACRITIC_CLASSES: Record<string, string> = {
  a: "aàáâäã",
  c: "cç",
  e: "eéèêë",
  i: "iíìîï",
  n: "nñ",
  o: "oóòôöõ",
  u: "uúùûü",
  y: "yýÿ",
};

interface Detector {
  regex: RegExp;
  type: PiiType;
  /** Clé d'unicité d'une occurrence (deux écritures d'une même PII → même jeton). */
  keyOf(rawMatch: string): string;
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeToken(value: string): string {
  return stripDiacritics(value).toLocaleLowerCase();
}

/**
 * Motif littéral d'un fragment de nom, tolérant aux diacritiques et à
 * l'apostrophe : « Chaïma » reconnaît « Chaima », « N'Diaye » reconnaît
 * « Ndiaye ». Ce sont des graphies courantes de la même personne, et seul le
 * motif est normalisé — le texte produit garde ses accents.
 *
 * La casse est portée par les classes et non par le flag `i`, parce que
 * `requireCapital` impose la casse de la seule initiale : sous `i`, `[P]` comme
 * `\p{Lu}` matchent aussi les minuscules.
 */
function toTokenPattern(token: string, requireCapital: boolean): string {
  let pattern = "";
  let atFirstLetter = true;

  for (const char of token) {
    if (char === "'" || char === "’") {
      pattern += "['’]?";
      continue;
    }
    if (!/\p{L}/u.test(char)) {
      pattern += escapeRegExp(char);
      continue;
    }
    const base = normalizeToken(char);
    const lower = DIACRITIC_CLASSES[base] ?? base;
    const upper = lower.toLocaleUpperCase();
    pattern +=
      requireCapital && atFirstLetter ? `[${upper}]` : `[${lower}${upper}]`;
    atFirstLetter = false;
  }

  return pattern;
}

/**
 * Transforme des valeurs de nom (champs identité, noms extraits par LLM…) en
 * fragments à caviarder : découpe en mots et sur les traits d'union, écarte les
 * particules, déduplique, trie du plus long au plus court pour caviarder
 * « Jean Dupont » avant « Jean ».
 */
function toNameTokens(values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();

  function add(token: string): void {
    if (token.length < MIN_NAME_TOKEN_LENGTH) return;
    if (NAME_PARTICLES.has(normalizeToken(token))) return;
    tokens.add(token);
  }

  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    // La valeur entière d'abord : elle porte les particules que `add` écarte.
    if (trimmed.includes(" ")) tokens.add(trimmed);
    // Un nom réduit à une particule (« Le », « Da ») reste un nom à caviarder.
    else if (NAME_PARTICLES.has(normalizeToken(trimmed))) tokens.add(trimmed);
    for (const token of trimmed.split(/\s+/)) {
      add(token);
      // « Nguyen-Legrand » est aussi cité par sa seule seconde partie.
      if (token.includes("-")) token.split("-").forEach(add);
    }
  }

  return [...tokens].sort((a, b) => b.length - a.length);
}

/**
 * Détecteur de nom : bornes sur frontière de lettre/chiffre, insensible à la
 * casse sauf pour les noms homonymes d'un mot courant, où une majuscule
 * initiale est exigée.
 */
function nameDetector(token: string): Detector {
  const normalized = normalizeToken(token);
  const requiresCapital =
    COMMON_WORD_NAMES.has(normalized) || NAME_PARTICLES.has(normalized);
  return {
    regex: new RegExp(
      `(?<![\\p{L}\\p{N}])${toTokenPattern(token, requiresCapital)}(?![\\p{L}\\p{N}])`,
      "gu",
    ),
    type: PII_TYPES.NAME,
    keyOf: (rawMatch) => normalizeToken(rawMatch),
  };
}

/**
 * Détecteur d'une chaîne citée telle quelle — une adresse, une date en toutes
 * lettres. Contrairement au détecteur de nom, elle n'est pas découpée en mots :
 * « allée des Cerisiers » contient une particule que `toNameTokens` écarterait.
 */
function literalDetector(value: string): Detector {
  return {
    regex: new RegExp(
      `(?<![\\p{L}\\p{N}])${toTokenPattern(value, false)}(?![\\p{L}\\p{N}])`,
      "gu",
    ),
    type: PII_TYPES.RESIDUAL,
    keyOf: (rawMatch) => normalizeToken(rawMatch),
  };
}

/** Nom complet et abréviation usuelle de chaque mois. */
const MONTHS: readonly (readonly [string, string])[] = [
  ["janvier", "janv"],
  ["février", "févr"],
  ["mars", "mars"],
  ["avril", "avr"],
  ["mai", "mai"],
  ["juin", "juin"],
  ["juillet", "juil"],
  ["août", "août"],
  ["septembre", "sept"],
  ["octobre", "oct"],
  ["novembre", "nov"],
  ["décembre", "déc"],
];

interface BirthDateParts {
  day: number;
  month: number;
  year: number;
}

/** `Report.birthDate` est une chaîne libre : les deux écritures coexistent. */
export function parseBirthDate(value: string): BirthDateParts | null {
  const trimmed = value.trim();

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(trimmed);
  if (iso) {
    return { year: +iso[1], month: +iso[2], day: +iso[3] };
  }
  const french = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
  if (french) {
    return { day: +french[1], month: +french[2], year: +french[3] };
  }

  // Saisie en toutes lettres, observée en base : « 01 JANVIER 1944 ».
  const spelled = /^(\d{1,2})(?:er)?\s+([\p{L}]+)\.?\s+(\d{4})$/u.exec(trimmed);
  if (spelled) {
    const written = normalizeToken(spelled[2]);
    const index = MONTHS.findIndex(
      ([full, short]) =>
        normalizeToken(full) === written || normalizeToken(short) === written,
    );
    if (index >= 0) {
      return { day: +spelled[1], month: index + 1, year: +spelled[3] };
    }
  }
  return null;
}

function monthPattern(month: number): string {
  const [full, short] = MONTHS[month - 1];
  const forms = full === short ? [full] : [full, short];
  return `(?:${forms.map((form) => toTokenPattern(form, false)).join("|")})\\.?`;
}

/**
 * Détecteurs de la date de naissance connue : écritures numériques, et écriture
 * en toutes lettres. La seconde est du dictionnaire, pas de la devinette — on
 * connaît la date, donc on sait l'écrire. Les deux partagent leur clé, donc le
 * même jeton.
 */
function birthDateDetectors(birthDate: string): Detector[] {
  const parts = parseBirthDate(birthDate);
  if (!parts) return [];

  const key = `${parts.year}-${parts.month}-${parts.day}`;
  const separator = "[ ./-]";
  const day = `0?${parts.day}`;
  const month = `0?${parts.month}`;
  const numeric = new RegExp(
    `(?<!\\d)(?:${day}${separator}${month}${separator}${parts.year}|${parts.year}${separator}${month}${separator}${day})(?!\\d)`,
    "g",
  );

  const dayForm = parts.day === 1 ? "(?:0?1er|0?1)" : day;
  const spelled = new RegExp(
    `(?<![\\p{L}\\p{N}])${dayForm}\\s+${monthPattern(parts.month)}\\s+${parts.year}(?![\\p{L}\\p{N}])`,
    "gu",
  );

  return [numeric, spelled].map((regex) => ({
    regex,
    type: PII_TYPES.BIRTH_DATE,
    keyOf: () => key,
  }));
}

/** Occurrences de la date de naissance connue, sous toutes ses écritures. */
export function findBirthDate(text: string, birthDate: string): string[] {
  return birthDateDetectors(birthDate).flatMap(({ regex }) =>
    Array.from(text.matchAll(regex), (match) => match[0]),
  );
}

const EMAIL_DETECTOR: Detector = {
  regex: new RegExp(EMAIL_PATTERN.source, "gi"),
  type: PII_TYPES.EMAIL,
  keyOf: (rawMatch) => rawMatch.toLocaleLowerCase(),
};

const CASE_NUMBER_DETECTOR: Detector = {
  regex: CASE_NUMBER_REGEX,
  type: PII_TYPES.CASE_NUMBER,
  keyOf: (rawMatch) => rawMatch,
};

const NUMBER_DETECTOR: Detector = {
  regex: NUMBER_REGEX,
  type: PII_TYPES.NUMBER,
  // Deux écritures d'un même numéro (espacé / compact) partagent leurs chiffres.
  keyOf: (rawMatch) => rawMatch.replace(/\D/g, ""),
};

interface DetectorResult {
  text: string;
  matches: PiiMatch[];
}

/**
 * Applique un détecteur sur le texte, remplace chaque occurrence par un jeton
 * stable et accumule les correspondances. `registry` et `counters` assurent la
 * cohérence des jetons entre détecteurs, champs et occurrences.
 */
function applyDetector(
  text: string,
  detector: Detector,
  registry: Map<string, PiiMatch>,
  counters: Record<PiiType, number>,
): DetectorResult {
  const matches: PiiMatch[] = [];

  const nextText = text.replace(detector.regex, (rawMatch: string) => {
    const key = `${detector.type}:${detector.keyOf(rawMatch)}`;
    const existing = registry.get(key);
    if (existing) return existing.placeholder;

    counters[detector.type] += 1;
    const placeholder = `[${PLACEHOLDER_LABELS[detector.type]}_${counters[detector.type]}]`;
    const match: PiiMatch = {
      type: detector.type,
      value: rawMatch,
      placeholder,
    };
    registry.set(key, match);
    matches.push(match);
    return placeholder;
  });

  return { text: nextText, matches };
}

function createCounters(): Record<PiiType, number> {
  return {
    [PII_TYPES.NUMBER]: 0,
    [PII_TYPES.NAME]: 0,
    [PII_TYPES.EMAIL]: 0,
    [PII_TYPES.BIRTH_DATE]: 0,
    [PII_TYPES.CASE_NUMBER]: 0,
    [PII_TYPES.RESIDUAL]: 0,
  };
}

/**
 * Pseudonymise un texte avec un jeu de détecteurs donné. `registry` et
 * `counters` sont partagés entre champs pour des jetons cohérents.
 */
function pseudonymizeText(
  text: string,
  detectors: Detector[],
  registry: Map<string, PiiMatch>,
  counters: Record<PiiType, number>,
): PseudonymizationResult {
  let current = text;
  const matches: PiiMatch[] = [];

  for (const detector of detectors) {
    // Une RegExp globale porte un état `lastIndex` mutable ; on en clone une
    // instance fraîche à chaque passe pour rester réentrant et sans effet de bord.
    const fresh: Detector = {
      ...detector,
      regex: new RegExp(detector.regex.source, detector.regex.flags),
    };
    const result = applyDetector(current, fresh, registry, counters);
    current = result.text;
    matches.push(...result.matches);
  }

  return { text: current, matches };
}

/**
 * Ordre des détecteurs : e-mail et date de naissance d'abord, pour qu'ils
 * sortent en un seul jeton au lieu d'être découpés par les détecteurs de nom et
 * de numéro ; puis les noms, du plus long au plus court ; puis les références de
 * dossier avant le détecteur numérique, plus glouton.
 */
function buildDetectors(
  identity?: CitizenIdentity,
  extraNames: string[] = [],
): Detector[] {
  const detectors: Detector[] = [EMAIL_DETECTOR];

  if (identity?.birthDate) {
    detectors.push(...birthDateDetectors(identity.birthDate));
  }

  const tokens = toNameTokens([
    identity?.firstName,
    identity?.lastName,
    identity?.maritalName,
    ...extraNames,
  ]);
  detectors.push(...tokens.map(nameDetector));

  detectors.push(CASE_NUMBER_DETECTOR, NUMBER_DETECTOR);
  return detectors;
}

/** Pseudonymise un texte libre unique, sur les seuls motifs fixes. */
export function pseudonymize(text: string): PseudonymizationResult {
  return pseudonymizeText(
    text,
    [EMAIL_DETECTOR, CASE_NUMBER_DETECTOR, NUMBER_DETECTOR],
    new Map(),
    createCounters(),
  );
}

/** Un champ du dossier, identifié pour être réécrit à sa place. */
export interface NamedField {
  key: string;
  text: string;
}

/**
 * Applique un jeu de détecteurs à tous les champs d'un dossier en partageant un
 * seul registre : la même personne reçoit le même jeton dans le signalement et
 * dans la douzième réponse.
 */
function applyToFields(
  fields: NamedField[],
  detectors: Detector[],
  counters: Record<PiiType, number>,
): { fields: NamedField[]; matches: PiiMatch[] } {
  const registry = new Map<string, PiiMatch>();
  const matches: PiiMatch[] = [];
  const next: NamedField[] = [];

  for (const field of fields) {
    const result = pseudonymizeText(field.text, detectors, registry, counters);
    next.push({ key: field.key, text: result.text });
    matches.push(...result.matches);
  }

  return { fields: next, matches };
}

/** Couche A sur un dossier entier : signalement et réponses. */
export function pseudonymizeFields(
  fields: NamedField[],
  identity?: CitizenIdentity,
  extraNames: string[] = [],
): { fields: NamedField[]; matches: PiiMatch[] } {
  return applyToFields(
    fields,
    buildDetectors(identity, extraNames),
    createCounters(),
  );
}

/**
 * Pseudonymise l'entrée du pipeline (subject + description) avec des jetons
 * cohérents entre les deux champs. `identity` active le caviardage du nom et de
 * la date de naissance du citoyen ; `extraNames` ajoute d'autres noms connus
 * (participants au fil, tiers détectés par la couche B).
 */
export function pseudonymizeReport(
  input: PipelineInput,
  identity?: CitizenIdentity,
  extraNames: string[] = [],
): { subject: string; description: string; matches: PiiMatch[] } {
  const { fields, matches } = pseudonymizeFields(
    [
      { key: "subject", text: input.subject },
      { key: "description", text: input.description },
    ],
    identity,
    extraNames,
  );

  return { subject: fields[0].text, description: fields[1].text, matches };
}

/**
 * Couche B (volet déterministe) : caviarde une liste de noms fournie (extraite
 * par LLM) dans des champs DÉJÀ pseudonymisés par la couche A. Continue la
 * numérotation des jetons `[NOM_n]` à partir de `startIndex` pour ne pas entrer
 * en collision avec les noms déjà caviardés.
 */
export function redactNamesInFields(
  fields: NamedField[],
  names: string[],
  startIndex: number,
): { fields: NamedField[]; matches: PiiMatch[] } {
  const counters = createCounters();
  counters[PII_TYPES.NAME] = startIndex;
  return applyToFields(fields, toNameTokens(names).map(nameDetector), counters);
}

/** Variante deux champs de `redactNamesInFields`, pour le pipeline d'origine. */
export function redactNames(
  fields: { subject: string; description: string },
  names: string[],
  startIndex: number,
): { subject: string; description: string; matches: PiiMatch[] } {
  const result = redactNamesInFields(
    [
      { key: "subject", text: fields.subject },
      { key: "description", text: fields.description },
    ],
    names,
    startIndex,
  );

  return {
    subject: result.fields[0].text,
    description: result.fields[1].text,
    matches: result.matches,
  };
}

/**
 * Caviarde littéralement les données citées par le juge. Les plus longues
 * d'abord, pour qu'une adresse complète parte avant l'un de ses fragments.
 */
export function redactLiterals(
  fields: NamedField[],
  values: string[],
  startIndex: number,
): { fields: NamedField[]; matches: PiiMatch[] } {
  const counters = createCounters();
  counters[PII_TYPES.RESIDUAL] = startIndex;
  const detectors = [...new Set(values.map((value) => value.trim()))]
    .filter((value) => value.length >= MIN_NAME_TOKEN_LENGTH)
    .sort((a, b) => b.length - a.length)
    .map(literalDetector);

  return applyToFields(fields, detectors, counters);
}
