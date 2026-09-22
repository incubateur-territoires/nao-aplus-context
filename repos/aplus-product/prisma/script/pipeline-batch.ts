import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../.env") });

import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { existsSync } from "node:fs";
import prisma from "@/lib/prisma";
import { runPipeline } from "@/lib/ai/pipeline";
import type { PipelineResult } from "@/lib/ai/pipeline";

/**
 * Batch : passe le pipeline IA EXISTANT (anonymisation couche A+B → résumé →
 * résumé court → tags thème/nature → guardrail anti-PII) sur un échantillon de
 * signalements de prod. But : voir concrètement ce que ça produit à l'échelle,
 * mesurer la couverture des tags et le taux de PII résiduelle.
 *
 * READ-ONLY : que des SELECT, n'écrit RIEN en base. Les livrables sont écrits
 * dans prisma/data/pipeline-batch/ :
 *   - results.jsonl : 1 ligne par signalement (reprise possible)
 *   - results.md    : aperçu lisible des premiers résultats
 *   - stats.md      : distribution des tags, trous, échecs guardrail
 *
 * Reprise : les ids déjà présents dans results.jsonl sont ignorés (on peut
 * relancer après interruption sans re-payer les appels Albert).
 *
 * Lancement (sur une base avec les données, idéalement un dump/staging) :
 *   ALBERT_MODEL=<id> tsx --env-file=.env prisma/script/pipeline-batch.ts
 * Options (env) : SAMPLE_SIZE=1000 CONCURRENCY=3 THROTTLE_MS=200
 */

const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE ?? 1000);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const THROTTLE_MS = Number(process.env.THROTTLE_MS ?? 200);
const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 3);
const OUTPUT_DIR = resolve(__dirname, "../data/pipeline-batch");
const JSONL_PATH = resolve(OUTPUT_DIR, "results.jsonl");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface ResultRecord {
  id: string;
  subject: string; // sujet pseudonymisé
  oneLine: string;
  summary: string;
  themes: string[];
  natures: string[];
  guardOk: boolean;
  guardViolations: number;
}

// Consomme le générateur du pipeline et renvoie le résultat final.
async function runOne(
  subject: string,
  description: string,
  firstName: string | null,
  lastName: string | null,
  maritalName: string | null,
): Promise<PipelineResult> {
  let result: PipelineResult | undefined;
  for await (const ev of runPipeline(
    { subject, description },
    { firstName, lastName, maritalName },
  )) {
    if (ev.type === "result") result = ev.result;
    if (ev.type === "error") throw new Error(ev.message);
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

interface SampledReport {
  id: string;
  subject: string;
  description: string;
  firstName: string | null;
  lastName: string | null;
  maritalName: string | null;
}

async function sampleReports(doneIds: Set<string>): Promise<SampledReport[]> {
  const total = await prisma.report.count();
  const take = Math.min(SAMPLE_SIZE, total);
  const step = Math.max(1, Math.floor(total / take));
  console.log(
    `Corpus : ${total} signalements → échantillon systématique de ${take} (1 sur ${step}).`,
  );

  const idRows = await prisma.report.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const pickedIds: string[] = [];
  for (let i = 0; i < idRows.length && pickedIds.length < take; i += step) {
    pickedIds.push(idRows[i].id);
  }

  const rows = await prisma.report.findMany({
    where: { id: { in: pickedIds } },
    select: {
      id: true,
      subject: true,
      description: true,
      firstName: true,
      lastName: true,
      maritalName: true,
    },
  });
  return rows.filter((r) => !doneIds.has(r.id));
}

interface Stats {
  ok: number;
  failed: number;
  guardFail: number;
  zeroThemes: number;
  zeroNatures: number;
  themeCounts: Map<string, number>;
  natureCounts: Map<string, number>;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function accumulate(stats: Stats, rec: ResultRecord): void {
  stats.ok++;
  if (!rec.guardOk) stats.guardFail++;
  if (rec.themes.length === 0) stats.zeroThemes++;
  if (rec.natures.length === 0) stats.zeroNatures++;
  rec.themes.forEach((t) => bump(stats.themeCounts, t));
  rec.natures.forEach((n) => bump(stats.natureCounts, n));
}

function loadExisting(stats: Stats): Set<string> {
  const doneIds = new Set<string>();
  if (!existsSync(JSONL_PATH)) return doneIds;
  const content = readFileSync(JSONL_PATH, "utf8");
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as ResultRecord;
      doneIds.add(rec.id);
      accumulate(stats, rec);
    } catch {
      // ligne corrompue ignorée
    }
  }
  if (doneIds.size > 0) {
    console.log(
      `Reprise : ${doneIds.size} signalements déjà traités, ignorés.`,
    );
  }
  return doneIds;
}

function renderStats(stats: Stats): string {
  const totalTagged = stats.ok;
  const sortEntries = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]);
  const pct = (n: number) =>
    totalTagged > 0 ? `${((n / totalTagged) * 100).toFixed(1)} %` : "—";

  const lines: string[] = [];
  lines.push(`# Stats du batch pipeline\n`);
  lines.push(
    `Traités : **${stats.ok}** · échecs : ${stats.failed} · guardrail KO : ${stats.guardFail} (${pct(stats.guardFail)})\n`,
  );
  lines.push(
    `Sans thème : ${stats.zeroThemes} (${pct(stats.zeroThemes)}) · sans nature : ${stats.zeroNatures} (${pct(stats.zeroNatures)})\n`,
  );
  lines.push(`\n## Distribution des thèmes\n`);
  for (const [t, c] of sortEntries(stats.themeCounts)) {
    lines.push(`- ${t} : ${c} (${pct(c)})`);
  }
  lines.push(`\n## Distribution des natures\n`);
  for (const [n, c] of sortEntries(stats.natureCounts)) {
    lines.push(`- ${n} : ${c} (${pct(c)})`);
  }
  lines.push(
    `\n_Lecture : un fort taux « sans thème » = trous de taxonomie ; ` +
      `une sur-concentration sur un tag = trop grossier ; guardrail KO = PII résiduelle à investiguer._\n`,
  );
  return lines.join("\n");
}

function renderPreview(records: ResultRecord[], limit = 30): string {
  const lines: string[] = [`# Aperçu des résultats (${limit} premiers)\n`];
  records.slice(0, limit).forEach((r) => {
    lines.push(`## ${r.subject}\n`);
    lines.push(`- **Résumé court** : ${r.oneLine}`);
    lines.push(`- **Thèmes** : ${r.themes.join(", ") || "—"}`);
    lines.push(`- **Natures** : ${r.natures.join(", ") || "—"}`);
    lines.push(`- **Guardrail** : ${r.guardOk ? "OK" : "⚠️ PII résiduelle"}`);
    lines.push(`\n> ${r.summary.replace(/\n/g, " ")}\n`);
  });
  return lines.join("\n");
}

async function main() {
  console.log(
    "=== Batch pipeline IA (anonymisation + résumé + tags) — READ-ONLY ===\n",
  );
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const stats: Stats = {
    ok: 0,
    failed: 0,
    guardFail: 0,
    zeroThemes: 0,
    zeroNatures: 0,
    themeCounts: new Map(),
    natureCounts: new Map(),
  };
  const doneIds = loadExisting(stats);
  const reports = await sampleReports(doneIds);
  console.log(
    `À traiter : ${reports.length} signalements (concurrence ${CONCURRENCY}).\n`,
  );

  const newRecords: ResultRecord[] = [];
  let nextIndex = 0;
  let processed = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= reports.length) break;
      const r = reports[i];
      try {
        const result = await withRetry(
          () =>
            runOne(
              r.subject,
              r.description,
              r.firstName,
              r.lastName,
              r.maritalName,
            ),
          r.id,
        );
        const rec: ResultRecord = {
          id: r.id,
          subject: result.pseudonymized.subject.slice(0, 200),
          oneLine: result.oneLine,
          summary: result.summary,
          themes: result.tags.themes,
          natures: result.tags.natures,
          guardOk: result.guard.ok,
          guardViolations: result.guard.violations.length,
        };
        appendFileSync(JSONL_PATH, JSON.stringify(rec) + "\n", "utf8");
        accumulate(stats, rec);
        newRecords.push(rec);
      } catch (error) {
        stats.failed++;
        console.warn(
          `  ⚠️ ${r.id} : échec définitif — ${(error as Error).message}`,
        );
      }
      processed++;
      if (processed % 25 === 0 || processed === reports.length) {
        console.log(`  ${processed}/${reports.length} traités`);
      }
      if (THROTTLE_MS > 0) await sleep(THROTTLE_MS);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()),
  );

  writeFileSync(resolve(OUTPUT_DIR, "stats.md"), renderStats(stats), "utf8");
  writeFileSync(
    resolve(OUTPUT_DIR, "results.md"),
    renderPreview(newRecords),
    "utf8",
  );

  console.log(
    `\n✅ Terminé. ${stats.ok} traités, ${stats.failed} échecs, ${stats.guardFail} guardrail KO.\n` +
      `   → ${JSONL_PATH}\n` +
      `   → ${resolve(OUTPUT_DIR, "stats.md")}\n` +
      `   → ${resolve(OUTPUT_DIR, "results.md")}`,
  );
}

main()
  .catch((error) => {
    console.error("Échec batch :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
