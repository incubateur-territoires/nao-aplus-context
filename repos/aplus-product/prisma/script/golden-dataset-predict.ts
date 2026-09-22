import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// `.env` n'existe qu'en local, en prod Scalingo injecte déjà l'environnement.
// L'import est fait via `require` et gardé par `existsSync` : `dotenv` n'est
// pas déclaré dans les dépendances de production et son import top-level ferait
// échouer le script dès son chargement là où il n'en a pas besoin.
const envPath = resolve(__dirname, "../../.env");
if (existsSync(envPath)) {
  const requireLocal = createRequire(__filename);
  const dotenv = requireLocal("dotenv") as {
    config(opts: { path: string }): void;
  };
  dotenv.config({ path: envPath });
}

import prisma from "@/lib/prisma";
import { loadBlindCorpus } from "@/lib/ai/golden-dataset/corpus";
import {
  GOLDEN_TAG_SYSTEM_PROMPT,
  GOLDEN_TAG_USER_TEMPLATE,
  goldenTagStep,
  promptHash,
  type GoldenTagRecipe,
} from "@/lib/ai/golden-dataset/golden-tag";
import { AlbertQuotaError } from "@/lib/ai/providers";
import { createUsageTotals, runWithUsage } from "@/lib/ai/usage";
import { checkPredictTarget } from "@/utils/golden-dataset-predict-guard";

/**
 * Fait tourner un modèle Albert « à blanc » sur le corpus du golden dataset :
 * il pose les deux mêmes tags que les annotateurs humains sans jamais voir les
 * leurs, pour que les deux séries soient comparables.
 *
 * ÉCRIT EN BASE, et uniquement dans GoldenDatasetRun et
 * GoldenDatasetPrediction. NE LIT JAMAIS GoldenDatasetAnnotation : la cécité
 * est garantie par le type `BlindItem` et par la sélection étroite de
 * `src/lib/ai/golden-dataset/`.
 *
 * Idempotent : le run est identifié par sa recette (modèle, hash des prompts,
 * température), pas par son exécution. Relancer la même commande reprend la
 * série là où elle s'est arrêtée au lieu d'en ouvrir une seconde.
 *
 * Lancement :
 *   ALBERT_MODEL=<id> bun run golden-dataset:predict
 * Options (env) : TEMPERATURE=0.2 CONCURRENCY=3 THROTTLE_MS=200 MAX_RETRIES=3
 *                 LIMIT=<n> pour un essai sur les premiers items seulement
 */

const TEMPERATURE = Number(process.env.TEMPERATURE ?? 0.2);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const THROTTLE_MS = Number(process.env.THROTTLE_MS ?? 200);
const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 3);
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let delay = 2000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Le quota épuisé ne se rattrape pas en réessayant : les attentes du
      // provider ont déjà couvert la fenêtre de rate limit.
      if (error instanceof AlbertQuotaError) throw error;
      if (attempt >= MAX_RETRIES) throw error;
      console.warn(
        `  ⚠️ ${label} : essai ${attempt + 1}/${MAX_RETRIES} échoué, retry dans ${delay}ms`,
      );
      await sleep(delay);
      delay *= 2;
    }
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

async function resolveRun(recipe: GoldenTagRecipe): Promise<string> {
  const hash = promptHash(GOLDEN_TAG_SYSTEM_PROMPT, GOLDEN_TAG_USER_TEMPLATE);
  const run = await prisma.goldenDatasetRun.upsert({
    where: {
      model_promptHash_temperature: {
        model: recipe.model,
        promptHash: hash,
        temperature: recipe.temperature,
      },
    },
    create: {
      model: recipe.model,
      systemPrompt: GOLDEN_TAG_SYSTEM_PROMPT,
      userTemplate: GOLDEN_TAG_USER_TEMPLATE,
      promptHash: hash,
      temperature: recipe.temperature,
    },
    update: {},
    select: { id: true },
  });
  console.log(
    `Recette : modèle ${recipe.model}, température ${recipe.temperature}, prompts ${hash.slice(0, 12)}.`,
  );
  return run.id;
}

async function main() {
  const verdict = checkPredictTarget(process.env);
  if (!verdict.ok) {
    throw new Error(`Exécution refusée : ${verdict.reason}`);
  }

  const model = process.env.ALBERT_MODEL;
  if (!model) {
    throw new Error(
      "ALBERT_MODEL manquante : c'est le modèle évalué, il identifie la série.",
    );
  }

  console.log("=== Prédictions du golden dataset (tagage à blanc) ===\n");

  const recipe: GoldenTagRecipe = { model, temperature: TEMPERATURE };
  const runId = await resolveRun(recipe);

  const corpus = await loadBlindCorpus(runId);
  const items = LIMIT === undefined ? corpus : corpus.slice(0, LIMIT);
  if (items.length === 0) {
    console.log("Série déjà complète : aucun item sans prédiction.");
    return;
  }
  console.log(
    `À prédire : ${items.length} item(s) (concurrence ${CONCURRENCY}).\n`,
  );

  const latencies: number[] = [];
  let nextIndex = 0;
  let processed = 0;
  let failed = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let calls = 0;
  let quotaExhausted = false;

  async function worker(): Promise<void> {
    while (!quotaExhausted) {
      const index = nextIndex++;
      if (index >= items.length) break;
      const item = items[index];
      const totals = createUsageTotals();
      try {
        const output = await runWithUsage(totals, () =>
          withRetry(() => goldenTagStep.run({ item, recipe }), item.id),
        );
        await prisma.goldenDatasetPrediction.upsert({
          where: { runId_itemId: { runId, itemId: item.id } },
          create: {
            runId,
            itemId: item.id,
            blockageTag: output.blockageTag,
            procedureTag: output.procedureTag,
            rawOutput: output.rawOutput,
            latencyMs: totals.latencyMs,
            inputTokens: totals.inputTokens,
            outputTokens: totals.outputTokens,
          },
          // La première prédiction gagne : deux workers qui viseraient le même
          // item n'en écrasent pas le résultat.
          update: {},
        });
        latencies.push(totals.latencyMs);
      } catch (error) {
        if (error instanceof AlbertQuotaError) {
          quotaExhausted = true;
          console.error(`\n⛔ ${error.message}`);
        } else {
          failed++;
          console.warn(
            `  ⚠️ ${item.id} : échec définitif, aucune prédiction écrite (${(error as Error).message})`,
          );
        }
      }
      inputTokens += totals.inputTokens;
      outputTokens += totals.outputTokens;
      calls += totals.calls;
      processed++;
      if (processed % 10 === 0 || processed === items.length) {
        console.log(`  ${processed}/${items.length} traités`);
      }
      if (THROTTLE_MS > 0) await sleep(THROTTLE_MS);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()),
  );

  const predicted = await prisma.goldenDatasetPrediction.count({
    where: { runId },
  });
  const corpusSize = await prisma.goldenDatasetItem.count();

  console.log(
    `\n✅ Terminé. ${processed} item(s) traité(s), ${failed} échec(s).\n` +
      `   Complétude de la série : ${predicted}/${corpusSize} item(s) du corpus.\n` +
      `   Tokens : ${inputTokens} en entrée, ${outputTokens} en sortie.\n` +
      `   Requêtes consommées sur le quota Albert : ${calls} (tentatives rejetées comprises).\n` +
      `   Latence médiane : ${median(latencies)} ms.\n` +
      `   Reprise : ALBERT_MODEL=${model} TEMPERATURE=${TEMPERATURE} bun run golden-dataset:predict`,
  );
}

main()
  .catch((error) => {
    console.error("Échec des prédictions golden dataset :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
