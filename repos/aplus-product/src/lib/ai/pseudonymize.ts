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
 *  1. Les identifiants numériques (NIR, NIF, CAF, téléphone, n° de dossier…).
 *     Ils partagent une propriété simple : ce sont des suites LONGUES de
 *     chiffres. Un détecteur unique de seuil les attrape tous, tout en
 *     PRÉSERVANT les chiffres courts porteurs de sens (durée, montant, date,
 *     nombre d'enfants) dont le résumé a besoin.
 *  2. Le nom du citoyen, connu via l'enregistrement Report, retiré par
 *     dictionnaire (déterministe, fiable, sans NER).
 *
 * Les noms de tiers cités en texte libre (un proche, un agent) ne sont PAS
 * couverts ici : ils relèvent de l'étape LLM de pseudonymisation.
 *
 * Chaque valeur détectée est remplacée par un jeton stable : la même valeur
 * reçoit toujours le même jeton, pour préserver la cohérence du texte transmis
 * aux étapes LLM.
 */

const PLACEHOLDER_LABELS: Record<PiiType, string> = {
  [PII_TYPES.NUMBER]: "NUMERO",
  [PII_TYPES.NAME]: "NOM",
};

/**
 * Suite d'au moins 7 chiffres, séparateurs espace/point/tiret tolérés.
 * Seuil à 7 : c'est la longueur du plus court identifiant du modèle (CAF) ;
 * en dessous on reste sur des nombres porteurs de sens (montants, années…).
 *
 * Limite assumée : un grand nombre groupé par espaces (« 1 500 000 ») ou une
 * date espacée (« 12 01 2024 ») peut être caviardé à tort. Rare dans ce
 * domaine, et on préfère sur-caviarder que laisser fuiter.
 */
const NUMBER_REGEX = /\d(?:[ .-]?\d){6,}/g;

/** Longueur minimale d'un fragment de nom pris en compte dans le dictionnaire. */
const MIN_NAME_TOKEN_LENGTH = 2;

interface Detector {
  regex: RegExp;
  type: PiiType;
  /** Clé d'unicité d'une occurrence (deux écritures d'une même PII → même jeton). */
  keyOf(rawMatch: string): string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Construit les fragments de nom à caviarder à partir de l'enregistrement.
 * Découpe chaque champ en mots, déduplique, et trie du plus long au plus court
 * pour caviarder « Jean Dupont » avant « Jean ».
 */
/**
 * Transforme des valeurs de nom (champs identité, noms extraits par LLM…) en
 * fragments à caviarder : découpe en mots, déduplique, trie du plus long au plus
 * court pour caviarder « Jean Dupont » avant « Jean ».
 */
function toNameTokens(values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    for (const token of value.trim().split(/\s+/)) {
      if (token.length >= MIN_NAME_TOKEN_LENGTH) tokens.add(token);
    }
  }

  return [...tokens].sort((a, b) => b.length - a.length);
}

/**
 * Détecteur de nom : match insensible à la casse, bornes sur frontière de
 * lettre/chiffre (gère les initiales accentuées, ex. « Étienne »).
 */
function nameDetector(token: string): Detector {
  const escaped = escapeRegExp(token);
  return {
    regex: new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu"),
    type: PII_TYPES.NAME,
    keyOf: (rawMatch) => rawMatch.toLocaleLowerCase(),
  };
}

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
  return { [PII_TYPES.NUMBER]: 0, [PII_TYPES.NAME]: 0 };
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
 * Construit l'ordre des détecteurs : noms d'abord (du plus long au plus court),
 * puis le détecteur numérique. Les noms proviennent de l'identité du citoyen et,
 * en option, d'une liste supplémentaire (ex. noms extraits par la couche B).
 */
function buildDetectors(
  identity?: CitizenIdentity,
  extraNames: string[] = [],
): Detector[] {
  const tokens = toNameTokens([
    identity?.firstName,
    identity?.lastName,
    identity?.maritalName,
    ...extraNames,
  ]);

  const detectors: Detector[] = tokens.map(nameDetector);
  detectors.push(NUMBER_DETECTOR);
  return detectors;
}

/** Pseudonymise un texte libre unique (numéros uniquement, sans dictionnaire). */
export function pseudonymize(text: string): PseudonymizationResult {
  return pseudonymizeText(text, [NUMBER_DETECTOR], new Map(), createCounters());
}

/**
 * Pseudonymise l'entrée du pipeline (subject + description) avec des jetons
 * cohérents entre les deux champs. `identity` active le caviardage du nom du
 * citoyen ; `extraNames` ajoute d'autres noms à caviarder (ex. tiers détectés).
 */
export function pseudonymizeReport(
  input: PipelineInput,
  identity?: CitizenIdentity,
  extraNames: string[] = [],
): { subject: string; description: string; matches: PiiMatch[] } {
  const detectors = buildDetectors(identity, extraNames);
  const registry = new Map<string, PiiMatch>();
  const counters = createCounters();

  const subject = pseudonymizeText(
    input.subject,
    detectors,
    registry,
    counters,
  );
  const description = pseudonymizeText(
    input.description,
    detectors,
    registry,
    counters,
  );

  return {
    subject: subject.text,
    description: description.text,
    matches: [...subject.matches, ...description.matches],
  };
}

/**
 * Couche B (volet déterministe) : caviarde une liste de noms fournie (extraite
 * par LLM) dans un texte DÉJÀ pseudonymisé par la couche A. Continue la
 * numérotation des jetons `[NOM_n]` à partir de `startIndex` pour ne pas entrer
 * en collision avec les noms déjà caviardés.
 */
export function redactNames(
  fields: { subject: string; description: string },
  names: string[],
  startIndex: number,
): { subject: string; description: string; matches: PiiMatch[] } {
  const detectors = toNameTokens(names).map(nameDetector);
  const registry = new Map<string, PiiMatch>();
  const counters = createCounters();
  counters[PII_TYPES.NAME] = startIndex;

  const subject = pseudonymizeText(
    fields.subject,
    detectors,
    registry,
    counters,
  );
  const description = pseudonymizeText(
    fields.description,
    detectors,
    registry,
    counters,
  );

  return {
    subject: subject.text,
    description: description.text,
    matches: [...subject.matches, ...description.matches],
  };
}
