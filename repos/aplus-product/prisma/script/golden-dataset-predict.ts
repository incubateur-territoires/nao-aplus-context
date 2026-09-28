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
  GOLDEN_TAG_USER_TEMPLATE,
  goldenTagStep,
  promptHash,
  selectSystemPrompt,
  type GoldenTagRecipe,
} from "@/lib/ai/golden-dataset/golden-tag";
import { predictAll } from "@/lib/ai/golden-dataset/predict-loop";
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
 * Lancement en texte libre, sur la liste fermée, ou sur les labels fins :
 *   ALBERT_MODEL=<id> bun run golden-dataset:predict
 *   TAXONOMY=closed ALBERT_MODEL=<id> bun run golden-dataset:predict
 *   TAXONOMY=fine ALBERT_MODEL=<id> bun run golden-dataset:predict
 * Chaque consigne a son propre hash, donc sa propre série ; toute autre valeur
 * de TAXONOMY est refusée avant le moindre appel.
 * Options (env) : TEMPERATURE=0.2 CONCURRENCY=3 THROTTLE_MS=200 MAX_RETRIES=3
 *                 LIMIT=<n> pour un essai sur les premiers items seulement
 */

const TEMPERATURE = Number(process.env.TEMPERATURE ?? 0.2);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const THROTTLE_MS = Number(process.env.THROTTLE_MS ?? 200);
const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 3);
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;

async function resolveRun(recipe: GoldenTagRecipe): Promise<string> {
  const hash = promptHash(recipe.systemPrompt, GOLDEN_TAG_USER_TEMPLATE);
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
      systemPrompt: recipe.systemPrompt,
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

  const taxonomy = process.env.TAXONOMY;
  const { name: consigne, systemPrompt } = selectSystemPrompt(taxonomy);

  console.log("=== Prédictions du golden dataset (tagage à blanc) ===\n");
  console.log(`Consigne : ${consigne}.`);

  const recipe: GoldenTagRecipe = {
    model,
    systemPrompt,
    temperature: TEMPERATURE,
  };
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

  const summary = await predictAll(
    items,
    (item) => goldenTagStep.run({ item, recipe }),
    async (item, output, usage) => {
      await prisma.goldenDatasetPrediction.upsert({
        where: { runId_itemId: { runId, itemId: item.id } },
        create: {
          runId,
          itemId: item.id,
          blockageTag: output.blockageTag,
          procedureTag: output.procedureTag,
          rawOutput: output.rawOutput,
          latencyMs: usage.latencyMs,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        },
        // La première prédiction gagne : deux workers qui viseraient le même
        // item n'en écrasent pas le résultat.
        update: {},
      });
    },
    {
      concurrency: CONCURRENCY,
      throttleMs: THROTTLE_MS,
      maxRetries: MAX_RETRIES,
      retryDelayMs: 2000,
    },
  );

  const predicted = await prisma.goldenDatasetPrediction.count({
    where: { runId },
  });
  const corpusSize = await prisma.goldenDatasetItem.count();
  const taxonomyEnv = taxonomy === undefined ? "" : `TAXONOMY=${taxonomy} `;

  console.log(
    `\n✅ Terminé. ${summary.processed} item(s) traité(s), ${summary.failed} échec(s).\n` +
      `   Complétude de la série : ${predicted}/${corpusSize} item(s) du corpus.\n` +
      `   Tokens : ${summary.inputTokens} en entrée, ${summary.outputTokens} en sortie.\n` +
      `   Requêtes consommées sur le quota Albert : ${summary.calls} (tentatives rejetées comprises).\n` +
      `   Latence médiane : ${summary.medianLatencyMs} ms.\n` +
      `   Reprise : ${taxonomyEnv}ALBERT_MODEL=${model} TEMPERATURE=${TEMPERATURE} bun run golden-dataset:predict`,
  );
}

main()
  .catch((error) => {
    console.error("Échec des prédictions golden dataset :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
