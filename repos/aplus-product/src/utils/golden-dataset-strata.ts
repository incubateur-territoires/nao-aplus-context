/**
 * Arithmétique de l'échantillon du golden dataset : parts de référence, quotas
 * entiers et redistribution. Module pur, sans accès base ni environnement, pour
 * que `prisma/script/golden-dataset-seed.ts` reste un simple orchestrateur.
 *
 * Il vit sous `src/` et non à côté du script parce que `prisma/script` est hors
 * de `tsconfig`, hors de `eslint src` et hors de Jest : le calcul qui décide de
 * la composition du corpus y serait sans filet.
 *
 * REFERENCE_SHARES est la répartition par opérateur sollicité observée en
 * PRODUCTION. Elle est figée plutôt que calculée sur la base courante parce que
 * la base de développement pointe sur le staging, dont la répartition n'est pas
 * représentative : le staging donne CPAM 33,0 % et une ligne CNAM à 6,0 %, la
 * production donne CPAM 38,1 % et aucun CNAM. Les organismes à 0 % en production
 * (MDPH, DRFIP, CRAM, Département, CCAS, Association, France Rénov', BDF,
 * Mission locale) n'y figurent pas : ils ne sont jamais tirés.
 */

export const REFERENCE_SHARES: ReadonlyArray<{
  shortName: string;
  share: number;
}> = [
  { shortName: "CPAM", share: 38.1 },
  { shortName: "CAF", share: 19.2 },
  { shortName: "CARSAT", share: 17.1 },
  { shortName: "CNAV", share: 9.1 },
  { shortName: "MSA", share: 5.1 },
  { shortName: "DDFIP", share: 4.5 },
  { shortName: "Préf", share: 2.3 },
  { shortName: "France Travail", share: 2.1 },
  { shortName: "URSSAF", share: 0.9 },
  { shortName: "Chèque énergie", share: 0.7 },
  { shortName: "Sous-Préf", share: 0.3 },
  { shortName: "La Poste", share: 0.1 },
  { shortName: "FS", share: 0.1 },
  { shortName: "CDAD", share: 0.1 },
  { shortName: "ANTS", share: 0.1 },
];

export interface Stratum {
  shortName: string;
  /** Part de référence en production, en pourcentage. */
  share: number;
  /** Part normalisée : les parts de référence somment à 99,8 et non à 100. */
  weight: number;
  /** Cible sur SAMPLE_SIZE, arrondie aux plus forts restes. */
  quota: number;
  existing: number;
  available: number;
  /** Ce qu'il resterait à écrire pour atteindre le quota. */
  need: number;
  /** Ce qu'on tire réellement sur ce run, après plafonnement et redistribution. */
  take: number;
  picked: number;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Répartit `total` unités entières entre les strates, proportionnellement aux
 * poids et sans dépasser `caps`, par plus forts restes. Les unités qu'une strate
 * saturée ne peut pas absorber repartent au tour suivant sur celles qui ont
 * encore de la marge.
 */
export function allocate(
  weights: number[],
  caps: number[],
  total: number,
): number[] {
  const allocated = weights.map(() => 0);
  let left = total;

  // Un tour place au moins une unité : le plus fort reste en reçoit une, et une
  // strate encore ouverte a par définition de la marge. D'où au plus `total`
  // tours ; la borne et le garde-fou « aucun progrès » sont redondants exprès.
  for (let round = 0; left > 0 && round <= total; round++) {
    const open: number[] = [];
    for (let i = 0; i < weights.length; i++) {
      if (allocated[i] < caps[i] && weights[i] > 0) open.push(i);
    }
    if (open.length === 0) break;

    const weightSum = sum(open.map((i) => weights[i]));
    if (weightSum <= 0) break;

    const exact = open.map((i) => (left * weights[i]) / weightSum);
    const units = exact.map((value) => Math.floor(value));
    const byRemainder = exact
      .map((value, k) => ({ k, remainder: value - Math.floor(value) }))
      .sort((a, b) => b.remainder - a.remainder);
    let assigned = sum(units);
    for (let r = 0; assigned < left; r++) {
      units[byRemainder[r % byRemainder.length].k]++;
      assigned++;
    }

    let placed = 0;
    open.forEach((i, k) => {
      const give = Math.min(units[k], caps[i] - allocated[i]);
      allocated[i] += give;
      placed += give;
    });
    if (placed === 0) break;
    left -= placed;
  }

  return allocated;
}

export function buildStrata(sampleSize: number): Stratum[] {
  const shareTotal = sum(REFERENCE_SHARES.map((entry) => entry.share));
  const weights = REFERENCE_SHARES.map((entry) => entry.share / shareTotal);
  const quotas = allocate(
    weights,
    weights.map(() => sampleSize),
    sampleSize,
  );
  return REFERENCE_SHARES.map((entry, index) => ({
    shortName: entry.shortName,
    share: entry.share,
    weight: weights[index],
    quota: quotas[index],
    existing: 0,
    available: 0,
    need: 0,
    take: 0,
    picked: 0,
  }));
}

/**
 * Fixe les prises définitives de ce run, redistribution comprise, AVANT tout
 * tirage d'identifiant.
 */
export function planTakes(strata: Stratum[], remaining: number): void {
  const weights = strata.map((stratum) => stratum.weight);
  strata.forEach((stratum) => {
    stratum.need = Math.max(0, stratum.quota - stratum.existing);
  });
  const capped = strata.map((stratum) =>
    Math.min(stratum.need, stratum.available),
  );
  const wanted = sum(capped);

  if (wanted > remaining) {
    // Un run interrompu a pu sur-remplir une strate via la redistribution : on
    // rabote pour ne jamais dépasser SAMPLE_SIZE au total.
    const takes = allocate(weights, capped, remaining);
    strata.forEach((stratum, index) => {
      stratum.take = takes[index];
    });
    return;
  }

  strata.forEach((stratum, index) => {
    stratum.take = capped[index];
  });

  const deficit = remaining - wanted;
  if (deficit === 0) return;

  const spare = strata.map((stratum) => stratum.available - stratum.take);
  const extra = allocate(weights, spare, deficit);
  strata.forEach((stratum, index) => {
    stratum.take += extra[index];
  });
}

/** Ce que la strate pouvait prendre : son besoin, plafonné par ses candidats. */
export function reachable(stratum: Stratum): number {
  return Math.min(stratum.need, stratum.available);
}
