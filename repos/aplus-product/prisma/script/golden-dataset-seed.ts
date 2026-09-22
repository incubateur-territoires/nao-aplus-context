import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../.env") });

import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { runPipeline } from "@/lib/ai/pipeline";
import { GENERIC_SUBJECTS } from "@/utils/anonymize-report";
import type { PipelineResult } from "@/lib/ai/pipeline";
import {
  buildStrata,
  planTakes,
  reachable,
  sum,
  type Stratum,
} from "@/utils/golden-dataset-strata";

/**
 * Constitue le corpus d'annotation (« golden dataset ») : SAMPLE_SIZE
 * signalements caviardés, stratifiés par organisme sollicité, écrits dans
 * GoldenDatasetItem.
 *
 * ÉCRIT EN BASE, et uniquement dans GoldenDatasetItem. Idempotent : une relance
 * ne renumérote jamais les positions déjà écrites et ne complète que ce qui
 * manque jusqu'à SAMPLE_SIZE.
 *
 * La répartition de référence et le calcul des quotas vivent dans
 * `src/utils/golden-dataset-strata.ts`, sous test.
 *
 * Lancement :
 *   bun run golden-dataset:seed
 * Options (env) : SAMPLE_SIZE=100 CONCURRENCY=3 THROTTLE_MS=200 MAX_RETRIES=3
 */

const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE ?? 100);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const THROTTLE_MS = Number(process.env.THROTTLE_MS ?? 200);
const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 3);

/**
 * On ne tire que les signalements adressés à un seul organisme, pour que chacun
 * appartienne à une strate et une seule : 178 537 signalements sur 186 377
 * (96,6 %) sont dans ce cas, la simplification reste fidèle au corpus.
 */
const SINGLE_ORGANIZATION = Prisma.sql`cardinality("requestedOrganizationShortNames") = 1`;

/**
 * Écarte les signalements anonymisés, dont le texte est du faker sans valeur
 * pour une annotation humaine.
 *
 * On relit le statut sur `Report` au lieu de se fier à `analytics.v_report_fact`.
 * La vue porte pourtant `WHERE status <> 'DELETED'` dans sa définition, mais
 * elle est matérialisée : mesuré en production le 2026-08-31, elle contenait
 * 141 343 signalements passés à DELETED depuis son dernier rafraîchissement
 * réussi, soit plus de la moitié du corpus. Un premier tirage de 5 en avait
 * ramené 2.
 *
 * Le second filtre, sur les dix libellés génériques de l'anonymisation, rattrape
 * un signalement anonymisé par un import ancien qui n'aurait pas reçu le statut.
 */
const NOT_ANONYMIZED = Prisma.sql`EXISTS (
    SELECT 1 FROM public."Report" src
    WHERE src.id = "reportId"
      AND src.status <> 'DELETED'
      AND src.subject <> ALL(${GENERIC_SUBJECTS}::text[])
  )`;

interface AvailabilityRow {
  shortName: string;
  available: number;
}

interface SeedTask {
  reportId: string;
  stratum: Stratum;
  subject: string;
  description: string;
  firstName: string | null;
  lastName: string | null;
  maritalName: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function logPlan(strata: Stratum[]): void {
  for (const stratum of strata) {
    if (stratum.available < stratum.need) {
      console.warn(
        `  ⚠️ ${stratum.shortName} : besoin de ${stratum.need}, seulement ${stratum.available} candidat(s) disponible(s) → manque ${stratum.need - stratum.available}`,
      );
    }
    const spread = stratum.take - reachable(stratum);
    if (spread > 0) {
      console.log(
        `  ↳ ${stratum.shortName} : +${spread} par redistribution du déficit`,
      );
    }
    if (spread < 0) {
      console.log(
        `  ↳ ${stratum.shortName} : ${spread} pour ne pas dépasser SAMPLE_SIZE`,
      );
    }
  }
}

function excludeClause(excludedIds: string[]): Prisma.Sql {
  // `<> ALL` sur un tableau vide est toujours vrai : on omet la condition plutôt
  // que de faire transiter un tableau vide jusqu'à Postgres.
  return excludedIds.length > 0
    ? Prisma.sql`AND "reportId" <> ALL(${excludedIds}::text[])`
    : Prisma.empty;
}

async function countAvailable(
  strata: Stratum[],
  excludedIds: string[],
): Promise<void> {
  const shortNames = strata.map((stratum) => stratum.shortName);
  const rows = await prisma.$queryRaw<AvailabilityRow[]>(Prisma.sql`
    SELECT "requestedOrganizationShortNames"[1] AS "shortName",
           COUNT(*)::int AS available
    FROM analytics.v_report_fact
    WHERE ${SINGLE_ORGANIZATION}
      AND ${NOT_ANONYMIZED}
      AND "requestedOrganizationShortNames"[1] = ANY(${shortNames}::text[])
      ${excludeClause(excludedIds)}
    GROUP BY 1
  `);

  const byShortName = new Map(
    rows.map((row) => [row.shortName, row.available]),
  );
  strata.forEach((stratum) => {
    stratum.available = byShortName.get(stratum.shortName) ?? 0;
  });
}

async function drawStratum(
  stratum: Stratum,
  excludedIds: string[],
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ reportId: string }[]>(Prisma.sql`
    SELECT "reportId"
    FROM analytics.v_report_fact
    WHERE ${SINGLE_ORGANIZATION}
      AND ${NOT_ANONYMIZED}
      AND "requestedOrganizationShortNames"[1] = ${stratum.shortName}
      ${excludeClause(excludedIds)}
    ORDER BY md5("reportId")
    LIMIT ${stratum.take}
  `);
  return rows.map((row) => row.reportId);
}

async function buildTasks(
  strata: Stratum[],
  excludedIds: string[],
): Promise<SeedTask[]> {
  const draws: { reportId: string; stratum: Stratum }[] = [];
  for (const stratum of strata) {
    if (stratum.take === 0) continue;
    const ids = await drawStratum(stratum, excludedIds);
    ids.forEach((reportId) => draws.push({ reportId, stratum }));
  }

  const reports = await prisma.report.findMany({
    where: { id: { in: draws.map((draw) => draw.reportId) } },
    select: {
      id: true,
      subject: true,
      description: true,
      firstName: true,
      lastName: true,
      maritalName: true,
    },
  });
  const byId = new Map(reports.map((report) => [report.id, report]));

  const tasks: SeedTask[] = [];
  for (const draw of draws) {
    const report = byId.get(draw.reportId);
    if (!report) {
      console.warn(
        `  ⚠️ ${draw.reportId} : introuvable dans Report (vue matérialisée en retard), ignoré`,
      );
      continue;
    }
    tasks.push({
      reportId: report.id,
      stratum: draw.stratum,
      subject: report.subject,
      description: report.description,
      firstName: report.firstName,
      lastName: report.lastName,
      maritalName: report.maritalName,
    });
  }
  return tasks;
}

/**
 * Couche A (caviardage local des numéros et du nom du citoyen) + couche B
 * (extraction LLM des noms de tiers). Un seul appel Albert par signalement :
 * résumé, résumé court et tags ne servent pas au corpus d'annotation.
 */
async function redact(task: SeedTask): Promise<PipelineResult> {
  let result: PipelineResult | undefined;
  for await (const event of runPipeline(
    { subject: task.subject, description: task.description },
    {
      firstName: task.firstName,
      lastName: task.lastName,
      maritalName: task.maritalName,
    },
    { skip: ["summary", "oneline", "tags"] },
  )) {
    if (event.type === "result") result = event.result;
    if (event.type === "error") throw new Error(event.message);
  }
  if (!result) throw new Error("pipeline terminé sans résultat");
  return result;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let delay = 2000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error;
      console.warn(
        `  ⚠️ ${label} : essai ${attempt + 1}/${MAX_RETRIES} échoué, retry dans ${delay}ms`,
      );
      await sleep(delay);
      delay *= 2;
    }
  }
}

function logDistribution(strata: Stratum[]): void {
  console.log("\nRépartition cible vs réalisée :");
  console.log(
    `  ${"organisme".padEnd(16)}${"cible".padStart(6)}${"réalisé".padStart(9)}${"écart".padStart(7)}`,
  );
  for (const stratum of strata) {
    const done = stratum.existing + stratum.picked;
    const gap = done - stratum.quota;
    const reason =
      stratum.available < stratum.need
        ? "  candidats insuffisants"
        : stratum.take > reachable(stratum)
          ? "  redistribution du déficit"
          : "";
    console.log(
      `  ${stratum.shortName.padEnd(16)}${String(stratum.quota).padStart(6)}${String(done).padStart(9)}${(gap > 0 ? `+${gap}` : String(gap)).padStart(7)}${reason}`,
    );
  }
}

async function main() {
  console.log("=== Seed du golden dataset (corpus caviardé, stratifié) ===\n");

  const existingItems = await prisma.goldenDatasetItem.findMany({
    select: { reportId: true, position: true, organization: true },
  });
  const strata = buildStrata(SAMPLE_SIZE);
  const byShortName = new Map(
    strata.map((stratum) => [stratum.shortName, stratum]),
  );
  for (const item of existingItems) {
    const stratum = byShortName.get(item.organization);
    if (stratum) stratum.existing++;
  }

  const remaining = SAMPLE_SIZE - existingItems.length;
  if (remaining <= 0) {
    console.log(
      `Corpus déjà complet : ${existingItems.length} item(s) en base pour SAMPLE_SIZE=${SAMPLE_SIZE}. Rien à écrire.`,
    );
    return;
  }
  console.log(
    `Déjà en base : ${existingItems.length} item(s) · à compléter : ${remaining} (SAMPLE_SIZE=${SAMPLE_SIZE}).`,
  );

  const excludedIds = existingItems.map((item) => item.reportId);
  await countAvailable(strata, excludedIds);
  planTakes(strata, remaining);
  logPlan(strata);

  const tasks = await buildTasks(strata, excludedIds);
  console.log(
    `\nÀ caviarder : ${tasks.length} signalement(s) (concurrence ${CONCURRENCY}).\n`,
  );

  let nextPosition =
    existingItems.reduce((max, item) => Math.max(max, item.position), 0) + 1;
  let nextIndex = 0;
  let processed = 0;
  let failed = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= tasks.length) break;
      const task = tasks[index];
      try {
        const result = await withRetry(() => redact(task), task.reportId);
        // L'incrément d'un entier est atomique vis-à-vis des workers : pas de
        // verrou, et aucune position brûlée quand le caviardage échoue.
        const position = nextPosition++;
        await prisma.goldenDatasetItem.create({
          data: {
            reportId: task.reportId,
            position,
            organization: task.stratum.shortName,
            subject: result.pseudonymized.subject,
            description: result.pseudonymized.description,
          },
        });
        task.stratum.picked++;
      } catch (error) {
        failed++;
        console.warn(
          `  ⚠️ ${task.reportId} : échec définitif — ${(error as Error).message}`,
        );
      }
      processed++;
      if (processed % 10 === 0 || processed === tasks.length) {
        console.log(`  ${processed}/${tasks.length} traités`);
      }
      if (THROTTLE_MS > 0) await sleep(THROTTLE_MS);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()),
  );

  logDistribution(strata);

  const written = sum(strata.map((stratum) => stratum.picked));
  const total = existingItems.length + written;
  console.log(
    `\n✅ Terminé. ${written} item(s) écrit(s), ${failed} échec(s) → ${total} item(s) dans le corpus.`,
  );
  if (total < SAMPLE_SIZE) {
    console.warn(
      `⚠️ Corpus insuffisant : ${total} item(s) pour un objectif de ${SAMPLE_SIZE}. ` +
        `Les strates disponibles ne suffisent pas à compléter l'échantillon.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Échec du seed golden dataset :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
