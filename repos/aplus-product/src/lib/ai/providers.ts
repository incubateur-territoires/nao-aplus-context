import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  APICallError,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from "ai";
import { createLogger } from "@/utils/logger";
import { recordFailedCall, recordUsage } from "./usage";

const logger = createLogger("albert");

/**
 * Configuration des fournisseurs LLM du pipeline IA.
 *
 * Albert (DINUM/Etalab) expose une API compatible OpenAI. On l'utilise pour les
 * étapes manipulant des données potentiellement sensibles : c'est un modèle
 * souverain, hébergé en France, ce qui évite tout transfert de PII hors UE.
 */

// `||` plutôt que `??` : une variable vide (ALBERT_BASE_URL=) doit aussi
// retomber sur le défaut. L'URL doit inclure le suffixe `/v1`.
const ALBERT_BASE_URL =
  process.env.ALBERT_BASE_URL || "https://albert.api.etalab.gouv.fr/v1";

const albert = createOpenAICompatible({
  name: "albert",
  baseURL: ALBERT_BASE_URL,
  apiKey: process.env.ALBERT_API_KEY ?? "",
});

/**
 * Attentes dédiées au 429 (rate limit Albert). Le retry par défaut du SDK
 * réessaie en quelques secondes — trop court pour une fenêtre de rate limit,
 * qui se compte en dizaines de secondes : chaque appel échouait vite et les
 * suivants tombaient en cascade dans la même fenêtre. Ici on attend assez
 * longtemps pour en sortir, en respectant l'en-tête Retry-After quand Albert
 * le fournit.
 */
const RATE_LIMIT_BACKOFF_MS = [5_000, 15_000, 30_000, 60_000];
const RETRY_AFTER_CAP_MS = 120_000;

/**
 * 429 persistant malgré ~110 s d'attentes : ce n'est plus un pic passager mais
 * un quota (horaire/journalier) épuisé. Erreur volontairement PAS un
 * `APICallError` : le retry du SDK ne la considère pas réessayable et la
 * propage immédiatement — l'appelant peut alors arrêter son run au lieu
 * d'enchaîner des signalements condamnés d'avance.
 */
export class AlbertQuotaError extends Error {
  constructor() {
    super(
      "Quota Albert épuisé : l'API répond 429 malgré les attentes. Réessayer plus tard (fenêtre horaire ou journalière).",
    );
    this.name = "AlbertQuotaError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.statusCode === 429;
}

function rateLimitDelayMs(error: unknown, attempt: number): number | null {
  if (!isRateLimitError(error)) return null;
  if (attempt >= RATE_LIMIT_BACKOFF_MS.length) return null;
  const retryAfter = Number(
    (error as APICallError).responseHeaders?.["retry-after"],
  );
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, RETRY_AFTER_CAP_MS);
  }
  return RATE_LIMIT_BACKOFF_MS[attempt];
}

// Comptabilise la consommation (tokens, appels) de chaque génération dans le
// contexte de suivi actif (cf. usage.ts, no-op hors contexte), et absorbe les
// rate limits en attendant la fin de la fenêtre au lieu d'échouer.
const albertMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",
  wrapGenerate: async ({ doGenerate }) => {
    for (let attempt = 0; ; attempt++) {
      const startedAt = Date.now();
      try {
        const result = await doGenerate();
        recordUsage(result.usage, Date.now() - startedAt);
        return result;
      } catch (error) {
        // Une tentative rejetée entame quand même le quota (RPM/RPD).
        recordFailedCall();
        const delayMs = rateLimitDelayMs(error, attempt);
        if (delayMs === null) {
          if (isRateLimitError(error)) {
            logger.error("quota Albert épuisé, abandon de l'appel");
            throw new AlbertQuotaError();
          }
          throw error;
        }
        logger.info("rate limit Albert, attente avant nouvel essai", {
          attempt: attempt + 1,
          delayMs,
        });
        await sleep(delayMs);
      }
    }
  },
};

/**
 * Modèle de génération de texte Albert. Le nom du modèle dépend du déploiement ;
 * sans argument on le lit dans l'env (lister les modèles disponibles via
 * `GET /v1/models`). L'argument sert aux appelants qui comparent plusieurs
 * modèles dans un même processus.
 */
export function albertChatModel(modelId?: string) {
  if (!process.env.ALBERT_API_KEY) {
    throw new Error(
      "ALBERT_API_KEY manquante. Ajoute-la dans .env (clé de l'API Albert).",
    );
  }
  const model = modelId ?? process.env.ALBERT_MODEL;
  if (!model) {
    throw new Error(
      "ALBERT_MODEL manquante. Liste les modèles avec : " +
        `curl -s ${ALBERT_BASE_URL}/models -H "Authorization: Bearer $ALBERT_API_KEY" | jq '.data[].id'`,
    );
  }
  return wrapLanguageModel({
    model: albert(model),
    middleware: albertMiddleware,
  });
}
