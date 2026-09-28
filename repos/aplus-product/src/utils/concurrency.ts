/**
 * Exécute un traitement sur une liste avec un nombre d'exécutions simultanées
 * borné. Les tâches tirent dans un index partagé plutôt que d'être découpées en
 * lots : une tâche lente ne laisse pas les autres files à l'arrêt.
 */
export async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  // `NaN` ne traiterait silencieusement aucun élément.
  if (Number.isNaN(concurrency)) {
    throw new RangeError("Concurrence invalide : NaN");
  }
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await run(items[index]);
    }
  }

  const workers = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
}
