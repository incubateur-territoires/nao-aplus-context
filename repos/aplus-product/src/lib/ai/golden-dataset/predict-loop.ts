import { AlbertQuotaError } from "../providers";
import { createUsageTotals, runWithUsage, type UsageTotals } from "../usage";

/**
 * Boucle de prédiction partagée par les scripts du golden dataset : workers
 * concurrents, retries à délai doublé, arrêt net au quota Albert épuisé.
 * Un item en échec définitif n'atteint jamais `onPredicted`.
 */

export interface PredictLoopOptions {
  readonly concurrency: number;
  readonly throttleMs: number;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
}

export interface PredictLoopSummary {
  readonly processed: number;
  readonly failed: number;
  readonly quotaExhausted: boolean;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Requêtes consommées sur le quota, tentatives rejetées comprises. */
  readonly calls: number;
  readonly medianLatencyMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  options: PredictLoopOptions,
): Promise<T> {
  let delay = options.retryDelayMs;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Les attentes du provider ont déjà couvert la fenêtre de rate limit.
      if (error instanceof AlbertQuotaError) throw error;
      if (attempt >= options.maxRetries) throw error;
      console.warn(
        `  ⚠️ ${label} : essai ${attempt + 1}/${options.maxRetries} échoué, retry dans ${delay}ms`,
      );
      await sleep(delay);
      delay *= 2;
    }
  }
}

export async function predictAll<Item extends { readonly id: string }, Output>(
  items: readonly Item[],
  predict: (item: Item) => Promise<Output>,
  onPredicted: (
    item: Item,
    output: Output,
    usage: UsageTotals,
  ) => Promise<void>,
  options: PredictLoopOptions,
): Promise<PredictLoopSummary> {
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
      const usage = createUsageTotals();
      try {
        const output = await runWithUsage(usage, () =>
          withRetry(() => predict(item), item.id, options),
        );
        await onPredicted(item, output, usage);
        latencies.push(usage.latencyMs);
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
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
      calls += usage.calls;
      processed++;
      if (processed % 10 === 0 || processed === items.length) {
        console.log(`  ${processed}/${items.length} traités`);
      }
      if (options.throttleMs > 0) await sleep(options.throttleMs);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, options.concurrency) }, () => worker()),
  );

  return {
    processed,
    failed,
    quotaExhausted,
    inputTokens,
    outputTokens,
    calls,
    medianLatencyMs: median(latencies),
  };
}
