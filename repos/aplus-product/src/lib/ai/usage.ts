import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Comptage de la consommation Albert (tokens, nombre d'appels).
 *
 * Le provider (cf. `providers.ts`) enregistre l'usage de CHAQUE appel LLM dans
 * le contexte actif via `recordUsage`. L'appelant qui veut mesurer un
 * traitement l'enveloppe dans `runWithUsage` : tous les appels faits pendant
 * son exécution (pipeline complet, étapes annexes) sont agrégés dans le même
 * accumulateur, sans rien changer aux signatures des steps. Hors contexte
 * (ex : route publique /ia), `recordUsage` est un no-op.
 */

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  calls: number;
  /**
   * Temps passé dans les générations réussies. Chronométré par le provider et
   * non par l'appelant : le back-off des 429 vit à l'intérieur du middleware,
   * si bien qu'une durée mesurée autour de l'appel engloberait jusqu'à deux
   * minutes de sommeil et ne dirait plus rien de la latence du modèle.
   */
  latencyMs: number;
}

const storage = new AsyncLocalStorage<UsageTotals>();

export function createUsageTotals(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, calls: 0, latencyMs: 0 };
}

export function runWithUsage<T>(
  totals: UsageTotals,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(totals, fn);
}

export function recordUsage(
  usage: {
    inputTokens: { total: number | undefined };
    outputTokens: { total: number | undefined };
  },
  latencyMs: number,
): void {
  const totals = storage.getStore();
  if (!totals) return;
  totals.calls += 1;
  totals.inputTokens += usage.inputTokens.total ?? 0;
  totals.outputTokens += usage.outputTokens.total ?? 0;
  totals.latencyMs += latencyMs;
}

/**
 * Comptabilise une tentative rejetée (429, erreur réseau…) : elle consomme une
 * requête du quota Albert (RPM/RPD) même sans réponse exploitable — `calls`
 * reflète ainsi le quota réellement entamé, pas les seuls succès.
 */
export function recordFailedCall(): void {
  const totals = storage.getStore();
  if (!totals) return;
  totals.calls += 1;
}
