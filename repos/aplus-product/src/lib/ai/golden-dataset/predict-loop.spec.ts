import { AlbertQuotaError } from "../providers";
import { recordUsage } from "../usage";
import { median, predictAll, type PredictLoopOptions } from "./predict-loop";

const OPTIONS: PredictLoopOptions = {
  concurrency: 2,
  throttleMs: 0,
  maxRetries: 1,
  retryDelayMs: 0,
};

const ITEMS = [{ id: "a" }, { id: "b" }, { id: "c" }];

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function usage(input: number, output: number) {
  return { inputTokens: { total: input }, outputTokens: { total: output } };
}

describe("predictAll", () => {
  it("rend chaque prédiction avec l'usage de son seul item", async () => {
    const seen: [string, string, number][] = [];
    const summary = await predictAll(
      ITEMS,
      async (item) => {
        recordUsage(usage(10, 2), 5);
        return `tags de ${item.id}`;
      },
      async (item, output, totals) => {
        seen.push([item.id, output, totals.inputTokens]);
      },
      OPTIONS,
    );

    expect(seen.sort()).toEqual([
      ["a", "tags de a", 10],
      ["b", "tags de b", 10],
      ["c", "tags de c", 10],
    ]);
    expect(summary).toMatchObject({
      processed: 3,
      failed: 0,
      inputTokens: 30,
      outputTokens: 6,
      calls: 3,
      medianLatencyMs: 5,
    });
  });

  it("réessaie puis abandonne l'item sans l'écrire", async () => {
    const attempts = new Map<string, number>();
    const written: string[] = [];
    const summary = await predictAll(
      ITEMS,
      async (item) => {
        attempts.set(item.id, (attempts.get(item.id) ?? 0) + 1);
        if (item.id === "b") throw new Error("réseau");
        return item.id;
      },
      async (item) => {
        written.push(item.id);
      },
      OPTIONS,
    );

    expect(attempts.get("b")).toBe(2);
    expect(written.sort()).toEqual(["a", "c"]);
    expect(summary.failed).toBe(1);
  });

  it("s'arrête au quota épuisé sans réessayer", async () => {
    let calls = 0;
    const summary = await predictAll(
      ITEMS,
      async () => {
        calls++;
        throw new AlbertQuotaError();
      },
      async () => {},
      { ...OPTIONS, concurrency: 1 },
    );

    expect(calls).toBe(1);
    expect(summary.quotaExhausted).toBe(true);
    expect(summary.processed).toBe(1);
  });
});

describe("median", () => {
  it("arrondit la moyenne des deux valeurs centrales", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2])).toBe(2);
  });
});
