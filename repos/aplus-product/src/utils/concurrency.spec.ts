import { mapWithConcurrency } from "./concurrency";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("mapWithConcurrency", () => {
  it("refuse une concurrence NaN plutôt que de ne rien traiter", async () => {
    await expect(
      mapWithConcurrency([1], Number.NaN, async () => {}),
    ).rejects.toThrow(RangeError);
  });

  it("traite tous les éléments", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      seen.push(item);
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("ne dépasse jamais la concurrence demandée", async () => {
    let running = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 20 }), 3, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
    });

    expect(peak).toBeLessThanOrEqual(3);
  });

  it("n'attend pas qu'une tâche lente libère les autres files", async () => {
    const slow = deferred();
    const order: string[] = [];

    const run = mapWithConcurrency(["lent", "a", "b"], 2, async (item) => {
      if (item === "lent") await slow.promise;
      order.push(item);
    });

    await Promise.resolve();
    slow.resolve();
    await run;

    expect(order).toEqual(["a", "b", "lent"]);
  });

  it("accepte une liste vide", async () => {
    const run = jest.fn();
    await mapWithConcurrency([], 4, run);
    expect(run).not.toHaveBeenCalled();
  });

  it("retombe sur une exécution séquentielle si la concurrence est nulle", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2], 0, async (item) => {
      seen.push(item);
    });
    expect(seen).toEqual([1, 2]);
  });
});
