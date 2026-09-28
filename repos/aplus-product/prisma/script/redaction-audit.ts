import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

config({ path: resolve(__dirname, "../../.env") });

import { findBirthDate } from "@/lib/ai/pseudonymize";
import { redactReport } from "@/lib/ai/redact-report";
import { remainingFragments } from "@/lib/ai/eval/score";
import { mapWithConcurrency } from "@/utils/concurrency";

/**
 * Mesure le caviardage sur de VRAIS signalements. Le corpus de
 * `src/lib/ai/eval/` est fabriqué : il dit si l'on a cassé quelque chose, pas
 * si le pipeline fuit sur des textes réels.
 *
 * AUCUNE CONNEXION À UNE BASE : le script lit un export JSON et n'importe pas
 * le client Prisma. Il n'écrit rien, ni en base ni en fichier.
 *
 * PROTOCOLE DE CONFIDENTIALITÉ — la raison d'être des deux sorties séparées :
 * la sortie standard ne contient QUE des compteurs, jamais un extrait de
 * signalement. Elle est faite pour être partagée. Les textes ne s'affichent
 * qu'avec `--review`, pour une relecture humaine à l'écran, et ne doivent être
 * recopiés nulle part. `--leaks` affiche de même, pour relecture, les seuls
 * dossiers en fuite ou refusés, avec la valeur en cause. Ce script n'est pas
 * lancé par un agent : il l'écrit, une personne l'exécute et en lit le résultat.
 *
 * Ce qui est vérifié : les données personnelles CONNUES EN BASE — nom, nom
 * marital, date de naissance, NIR, CAF, NIF, téléphone, noms des auteurs du fil
 * — ont-elles disparu du texte produit ? Seules celles réellement présentes
 * dans le texte d'origine sont comptées : vérifier la disparition d'un NIR qui
 * n'était pas écrit ne prouve rien.
 *
 * Ce qui n'est PAS vérifié, et que seule la relecture attrape : les données
 * inconnues de la base — un tiers cité, une adresse, un employeur nommé.
 *
 * Source : un export JSON (AUDIT_INPUT, obligatoire), produit par une requête
 * SQL exécutée par une personne, et rangé sous prisma/data/, qui est
 * git-ignoré.
 *
 * Lancement :
 *   AUDIT_INPUT=prisma/data/audit-reports.json bun run redaction:audit
 *   AUDIT_INPUT=prisma/data/audit-reports.json bun run redaction:audit -- --review
 */

// Même défaut que le service : à 4, un audit sur mille dossiers a épuisé ses
// tentatives sur des 429.
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 2);
const REVIEW = process.argv.includes("--review");
const LEAKS = process.argv.includes("--leaks");
const INPUT = process.env.AUDIT_INPUT;

/**
 * Seul dossier où un export de signalements réels a le droit de vivre : il est
 * git-ignoré. Un export rangé ailleurs pourrait être commité par erreur dans un
 * dépôt public.
 */
const ALLOWED_INPUT_DIR = resolve(__dirname, "../data");

/** Part de jetons au-delà de laquelle un texte a probablement perdu son sens. */
const OVER_REDACTION_RATIO = 0.4;

interface KnownValue {
  category: string;
  value: string;
}

/** Un dossier qui pose question : au moins une fuite, ou un refus. */
interface Finding {
  reportId: string;
  leaks: { category: string; value: string; remaining: string[] }[];
  violations: string[];
  producedText: string;
}

interface AuditCounters {
  processed: number;
  refused: number;
  failed: number;
  knownPresent: number;
  knownSurviving: number;
  survivingByCategory: Map<string, number>;
  overRedacted: number;
  findings: Finding[];
}

function push(counters: AuditCounters, category: string): void {
  counters.survivingByCategory.set(
    category,
    (counters.survivingByCategory.get(category) ?? 0) + 1,
  );
}

function fullName(
  person: { firstName: string; lastName: string } | null,
): string | null {
  if (!person) return null;
  const name = `${person.firstName} ${person.lastName}`.trim();
  return name.length > 0 ? name : null;
}

function participantNamesOf(report: {
  author: { firstName: string; lastName: string } | null;
  answers: { author: { firstName: string; lastName: string } | null }[];
}): string[] {
  const names = [
    fullName(report.author),
    ...report.answers.map((answer) => fullName(answer.author)),
  ];
  return [...new Set(names.filter((name): name is string => name !== null))];
}

/** La date de naissance se cherche sous toutes ses écritures, pas seulement celle stockée. */
function occurrencesOf(text: string, known: KnownValue): string[] {
  return known.category === "BIRTH_DATE"
    ? findBirthDate(text, known.value)
    : remainingFragments(text, known.value);
}

function knownValuesOf(report: {
  firstName: string;
  lastName: string;
  maritalName: string | null;
  birthDate: string;
  nir: string | null;
  caf: string | null;
  nif: string | null;
  phone: string | null;
  author: { firstName: string; lastName: string } | null;
  answers: { author: { firstName: string; lastName: string } | null }[];
}): KnownValue[] {
  const values: KnownValue[] = [
    { category: "CITIZEN_NAME", value: report.firstName },
    { category: "CITIZEN_NAME", value: report.lastName },
    { category: "BIRTH_DATE", value: report.birthDate },
  ];

  if (report.maritalName) {
    values.push({ category: "CITIZEN_NAME", value: report.maritalName });
  }
  for (const [category, value] of [
    ["NIR", report.nir],
    ["CAF", report.caf],
    ["NIF", report.nif],
    ["PHONE", report.phone],
  ] as const) {
    if (value) values.push({ category, value });
  }

  const participants = [report.author, ...report.answers.map((a) => a.author)];
  for (const person of participants) {
    if (!person) continue;
    values.push({ category: "PARTICIPANT_NAME", value: person.firstName });
    values.push({ category: "PARTICIPANT_NAME", value: person.lastName });
  }

  // Un même auteur signe souvent plusieurs messages : une valeur compte une fois.
  const seen = new Set<string>();
  return values.filter((entry) => {
    const key = `${entry.category}:${entry.value.trim().toLocaleLowerCase()}`;
    if (entry.value.trim().length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Part du texte occupée par des jetons de caviardage. */
function placeholderRatio(text: string): number {
  if (text.length === 0) return 0;
  const covered = [...text.matchAll(/\[[A-Z_]+_\d+\]/g)].reduce(
    (total, match) => total + match[0].length,
    0,
  );
  return covered / text.length;
}

interface Person {
  firstName: string;
  lastName: string;
}

interface AuditedReport {
  id: string;
  subject: string;
  description: string;
  firstName: string;
  lastName: string;
  maritalName: string | null;
  birthDate: string;
  nir: string | null;
  caf: string | null;
  nif: string | null;
  phone: string | null;
  author: Person | null;
  answers: { id: string; content: string; author: Person | null }[];
}

/**
 * Un éditeur SQL exporte le résultat ligne par ligne : la requête renvoie une
 * ligne d'une colonne, d'où `[{ "json_agg": [...] }]` au lieu du tableau. On
 * déballe cette enveloppe, y compris quand la valeur a été exportée en texte.
 */
function unwrapExport(parsed: unknown): unknown {
  if (!Array.isArray(parsed) || parsed.length !== 1) return parsed;

  const row: unknown = parsed[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) return parsed;

  const columns = Object.values(row);
  if (columns.length !== 1) return parsed;

  const [value] = columns;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const inner: unknown = JSON.parse(value);
    if (Array.isArray(inner)) return inner;
  }
  return parsed;
}

/** Refuse un fichier hors de prisma/data/ et vérifie la forme minimale. */
function readExport(path: string): AuditedReport[] {
  const absolute = resolve(process.cwd(), path);
  const fromAllowed = relative(ALLOWED_INPUT_DIR, absolute);
  if (fromAllowed.startsWith("..") || fromAllowed === absolute) {
    throw new Error(
      `L'export doit être rangé sous prisma/data/, qui est git-ignoré. Reçu : ${path}`,
    );
  }

  const parsed = unwrapExport(JSON.parse(readFileSync(absolute, "utf8")));
  if (!Array.isArray(parsed)) {
    throw new Error("L'export doit être un tableau JSON de signalements.");
  }
  for (const entry of parsed) {
    if (
      typeof entry?.id !== "string" ||
      typeof entry?.description !== "string" ||
      !Array.isArray(entry?.answers)
    ) {
      throw new Error(
        "Forme inattendue : chaque signalement doit porter id, description et answers.",
      );
    }
  }
  return parsed as AuditedReport[];
}

async function auditOne(
  report: AuditedReport,
  counters: AuditCounters,
): Promise<void> {
  const reportId = report.id;

  const originalText = [
    report.subject,
    report.description,
    ...report.answers.map((answer) => answer.content),
  ].join("\n");

  let result;
  try {
    result = await redactReport({
      subject: report.subject,
      description: report.description,
      answers: report.answers.map((answer) => ({
        id: answer.id,
        content: answer.content,
      })),
      identity: {
        firstName: report.firstName,
        lastName: report.lastName,
        maritalName: report.maritalName,
        birthDate: report.birthDate,
      },
      participantNames: participantNamesOf(report),
    });
  } catch (error) {
    counters.failed += 1;
    console.error(`  ⚠️ ${reportId.slice(0, 8)} : ${(error as Error).message}`);
    return;
  }

  counters.processed += 1;
  if (!result.guard.ok) counters.refused += 1;

  const producedText = [
    result.subject,
    result.description,
    ...result.answers.map((answer) => answer.content),
  ].join("\n");

  const leaks: Finding["leaks"] = [];
  for (const known of knownValuesOf(report)) {
    // Une valeur absente du texte d'origine ne prouve rien en disparaissant.
    if (occurrencesOf(originalText, known).length === 0) continue;

    counters.knownPresent += 1;
    const remaining = occurrencesOf(producedText, known);
    if (remaining.length > 0) {
      counters.knownSurviving += 1;
      push(counters, known.category);
      leaks.push({ category: known.category, value: known.value, remaining });
    }
  }

  if (leaks.length > 0 || !result.guard.ok) {
    counters.findings.push({
      reportId,
      leaks,
      violations: result.guard.violations.map((violation) => violation.value),
      producedText,
    });
  }

  if (placeholderRatio(producedText) > OVER_REDACTION_RATIO) {
    counters.overRedacted += 1;
  }

  if (REVIEW) {
    console.log(`\n--- ${reportId.slice(0, 8)} ---\n${producedText}`);
  }
}

async function main(): Promise<void> {
  if (!INPUT) {
    throw new Error(
      "AUDIT_INPUT manquante : indiquer le chemin d'un export JSON rangé sous prisma/data/ (ex. AUDIT_INPUT=prisma/data/audit-reports.json). Ce script ne lit jamais une base.",
    );
  }

  console.log("=== Audit du caviardage sur signalements réels ===\n");
  console.log("Source : export JSON, aucune base consultée\n");

  const reports = readExport(INPUT);
  if (reports.length === 0) {
    console.log("Aucun signalement dans l'export.");
    return;
  }
  console.log(`Signalements à auditer : ${reports.length}\n`);

  const counters: AuditCounters = {
    processed: 0,
    refused: 0,
    failed: 0,
    knownPresent: 0,
    knownSurviving: 0,
    survivingByCategory: new Map(),
    overRedacted: 0,
    findings: [],
  };

  await mapWithConcurrency(reports, CONCURRENCY, (report) =>
    auditOne(report, counters),
  );

  console.log("\n=== Compteurs (aucune donnée personnelle) ===");
  console.log(`  dossiers traités          : ${counters.processed}`);
  console.log(`  refusés par la garde      : ${counters.refused}`);
  console.log(`  échecs d'appel            : ${counters.failed}`);
  console.log(`  PII connues présentes     : ${counters.knownPresent}`);
  console.log(`  PII ayant survécu         : ${counters.knownSurviving}`);
  for (const [category, count] of counters.survivingByCategory) {
    console.log(`      ${category.padEnd(18)}: ${count}`);
  }
  console.log(
    `  textes très caviardés     : ${counters.overRedacted} (plus de ${OVER_REDACTION_RATIO * 100} % de jetons)`,
  );

  if (LEAKS) {
    console.log(
      "\n=== Dossiers à examiner (données réelles, ne pas recopier) ===",
    );
    for (const finding of counters.findings) {
      console.log(`\n--- ${finding.reportId.slice(0, 8)} ---`);
      for (const leak of finding.leaks) {
        console.log(
          `  fuite ${leak.category} : « ${leak.value} » → reste « ${leak.remaining.join(" ")} »`,
        );
      }
      if (finding.violations.length > 0) {
        console.log(
          `  refusé, le juge cite : ${finding.violations.join(" · ")}`,
        );
      }
      console.log(`\n${finding.producedText}`);
    }
  }

  if (!REVIEW && !LEAKS) {
    console.log(
      `\nLes textes ne sont pas affichés. ${counters.findings.length} dossier(s) à examiner : --leaks · tout relire : --review`,
    );
  }
  if (counters.knownSurviving > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
