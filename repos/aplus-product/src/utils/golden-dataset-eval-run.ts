import { z } from "zod";
import {
  RUN_MODE_KINDS,
  type ScoringPrediction,
} from "@/utils/golden-dataset-scoring";

/**
 * Fichier d'une série de prédictions, un par recette (modèle, consigne,
 * température). Il porte sa recette complète : une série reste lisible et
 * corrigeable après que la consigne du code a changé.
 */

export const EVAL_RUN_FORMAT = 1;

const recipeSchema = z.object({
  model: z.string().min(1),
  mode: z.enum(RUN_MODE_KINDS),
  /** Version de la liste fermée que la consigne expose ; `null` en texte libre. */
  taxonomyVersion: z.number().int().nullable(),
  systemPrompt: z.string().min(1),
  userTemplate: z.string().min(1),
  promptHash: z.string().min(1),
  temperature: z.number(),
  createdAt: z.string(),
  /** Ce qui distingue cette version de consigne, lu dans `NOTE` ; hors identité. */
  note: z.string().nullable().default(null),
});

const predictionSchema = z.object({
  blockageTag: z.string().nullable(),
  procedureTag: z.string().nullable(),
  rawOutput: z.string(),
  latencyMs: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
});

const runFileSchema = z.object({
  format: z.literal(EVAL_RUN_FORMAT),
  recipe: recipeSchema,
  predictions: z.record(z.string(), predictionSchema),
});

export type EvalRecipe = z.infer<typeof recipeSchema>;
export type EvalPrediction = z.infer<typeof predictionSchema>;
export type EvalRunFile = z.infer<typeof runFileSchema>;

export function emptyRunFile(recipe: EvalRecipe): EvalRunFile {
  return { format: EVAL_RUN_FORMAT, recipe, predictions: {} };
}

/** Deux recettes de même identité écrivent dans le même fichier. */
export function runFileName(recipe: EvalRecipe): string {
  const model = recipe.model.replace(/[^A-Za-z0-9.-]+/g, "-");
  return `${recipe.mode}_${model}_${recipe.promptHash.slice(0, 12)}_t${recipe.temperature}.json`;
}

export function sameRecipe(a: EvalRecipe, b: EvalRecipe): boolean {
  return (
    a.model === b.model &&
    a.promptHash === b.promptHash &&
    a.temperature === b.temperature
  );
}

export function parseRunFile(text: string, fileName: string): EvalRunFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `${fileName} : JSON illisible (${(error as Error).message}).`,
    );
  }

  const parsed = runFileSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `${fileName} : fichier de série invalide, ${issue.path.join(".") || "racine"} : ${issue.message}.`,
    );
  }

  return parsed.data;
}

export function scoringPredictionsOf(file: EvalRunFile): ScoringPrediction[] {
  return Object.entries(file.predictions).map(([itemId, prediction]) => ({
    itemId,
    blockageTag: prediction.blockageTag,
    procedureTag: prediction.procedureTag,
  }));
}
