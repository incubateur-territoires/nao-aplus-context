import {
  createPipelineBudget,
  isExhausted,
  isOutage,
  recordOutcome,
  reserveCall,
} from "./pipeline-budget";
import { API_FAILURE_THRESHOLD } from "./pseudonymization-policy";

describe("pipeline-budget", () => {
  it("n'accorde pas plus d'appels que le plafond", () => {
    const budget = createPipelineBudget(2);
    expect(reserveCall(budget)).toBe(true);
    expect(reserveCall(budget)).toBe(true);
    expect(reserveCall(budget)).toBe(false);
    expect(budget.used).toBe(2);
    expect(isExhausted(budget)).toBe(true);
  });

  it("coupe après des pannes consécutives", () => {
    const budget = createPipelineBudget(100);
    for (let i = 0; i < API_FAILURE_THRESHOLD; i++) recordOutcome(budget, true);
    expect(isOutage(budget)).toBe(true);
    expect(reserveCall(budget)).toBe(false);
  });

  it("rouvre le compteur de panne dès qu'une réponse arrive", () => {
    const budget = createPipelineBudget(100);
    for (let i = 0; i < API_FAILURE_THRESHOLD - 1; i++) {
      recordOutcome(budget, true);
    }
    recordOutcome(budget, false);
    recordOutcome(budget, true);
    expect(isOutage(budget)).toBe(false);
  });
});
