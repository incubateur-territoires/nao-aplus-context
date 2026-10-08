import { API_FAILURE_THRESHOLD } from "@/utils/pseudonymization-policy";

/**
 * Budget d'appels au pipeline d'un run, partagé par toutes ses phases, et
 * disjoncteur : après `API_FAILURE_THRESHOLD` pannes d'affilée, plus d'appel.
 */
export interface PipelineBudget {
  readonly limit: number;
  used: number;
  consecutiveOutages: number;
}

export function createPipelineBudget(limit: number): PipelineBudget {
  return { limit, used: 0, consecutiveOutages: 0 };
}

export function isOutage(budget: PipelineBudget): boolean {
  return budget.consecutiveOutages >= API_FAILURE_THRESHOLD;
}

export function isExhausted(budget: PipelineBudget): boolean {
  return isOutage(budget) || budget.used >= budget.limit;
}

/** Synchrone : deux tâches concurrentes ne peuvent pas réserver le même dernier appel. */
export function reserveCall(budget: PipelineBudget): boolean {
  if (isExhausted(budget)) return false;
  budget.used += 1;
  return true;
}

/** Toute réponse du fournisseur, refus compris, prouve qu'il fonctionne. */
export function recordOutcome(budget: PipelineBudget, outage: boolean): void {
  budget.consecutiveOutages = outage ? budget.consecutiveOutages + 1 : 0;
}
