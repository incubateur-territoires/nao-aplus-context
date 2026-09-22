import {
  allocate,
  buildStrata,
  planTakes,
  reachable,
  sum,
  REFERENCE_SHARES,
  type Stratum,
} from "./golden-dataset-strata";

function quotasByName(sampleSize: number): Record<string, number> {
  return Object.fromEntries(
    buildStrata(sampleSize).map((stratum) => [
      stratum.shortName,
      stratum.quota,
    ]),
  );
}

function withAvailability(
  sampleSize: number,
  available: Record<string, number>,
  fallback: number,
): Stratum[] {
  const strata = buildStrata(sampleSize);
  for (const stratum of strata) {
    stratum.available = available[stratum.shortName] ?? fallback;
  }
  return strata;
}

describe("buildStrata", () => {
  it("reproduit la répartition de production sur un échantillon de 100", () => {
    // Les parts de référence somment à 99,8 et non à 100 : sans normalisation
    // avant les plus forts restes, ces quotas ne tomberaient pas juste.
    expect(quotasByName(100)).toEqual({
      CPAM: 38,
      CAF: 19,
      CARSAT: 17,
      CNAV: 9,
      MSA: 5,
      DDFIP: 5,
      Préf: 3,
      "France Travail": 2,
      URSSAF: 1,
      "Chèque énergie": 1,
      "Sous-Préf": 0,
      "La Poste": 0,
      FS: 0,
      CDAD: 0,
      ANTS: 0,
    });
  });

  it("somme toujours exactement à la taille demandée", () => {
    for (const size of [1, 37, 100, 250, 500, 1000]) {
      const total = sum(buildStrata(size).map((stratum) => stratum.quota));
      expect(total).toBe(size);
    }
  });

  it("ne fait apparaître les organismes sous 1 % qu'à partir de 700", () => {
    // Mesuré, pas estimé : à 500 les quatre plus petits valent encore zéro.
    // Utile quand on décide d'agrandir le corpus pour les couvrir.
    const petits = ["La Poste", "FS", "CDAD", "ANTS"];

    for (const nom of petits) {
      expect(quotasByName(100)[nom]).toBe(0);
      expect(quotasByName(500)[nom]).toBe(0);
      expect(quotasByName(700)[nom]).toBeGreaterThan(0);
    }
  });

  it("couvre exactement les organismes de la table de référence", () => {
    expect(buildStrata(100).map((stratum) => stratum.shortName)).toEqual(
      REFERENCE_SHARES.map((entry) => entry.shortName),
    );
  });
});

describe("planTakes", () => {
  it("prend son quota quand chaque strate a de quoi", () => {
    const strata = withAvailability(100, {}, 1000);
    planTakes(strata, 100);

    for (const stratum of strata) {
      expect(stratum.take).toBe(stratum.quota);
    }
  });

  it("redistribue le déficit d'une strate à court pour rendre 100 items", () => {
    // Cas réel du staging : la production pèse CPAM à 38 %, le staging n'a pas
    // autant de candidats.
    const strata = withAvailability(100, { CPAM: 5 }, 1000);
    planTakes(strata, 100);

    expect(strata.find((s) => s.shortName === "CPAM")?.take).toBe(5);
    expect(sum(strata.map((s) => s.take))).toBe(100);
  });

  it("ne dépasse jamais les candidats disponibles", () => {
    const strata = withAvailability(100, { CPAM: 5, CAF: 2 }, 6);
    planTakes(strata, 100);

    for (const stratum of strata) {
      expect(stratum.take).toBeLessThanOrEqual(stratum.available);
    }
  });

  it("s'arrête au corpus disponible plutôt que de le surestimer", () => {
    const strata = withAvailability(100, {}, 2);
    planTakes(strata, 100);

    expect(sum(strata.map((s) => s.take))).toBe(30);
  });

  it("ne complète que ce qui manque après une reprise", () => {
    const strata = withAvailability(100, {}, 1000);
    for (const stratum of strata) {
      stratum.existing = stratum.quota;
    }
    strata[0].existing = strata[0].quota - 4;
    planTakes(strata, 4);

    expect(strata[0].take).toBe(4);
    expect(sum(strata.slice(1).map((s) => s.take))).toBe(0);
  });

  it("ne dépasse pas la taille cible quand une strate est déjà sur-remplie", () => {
    const strata = withAvailability(100, {}, 1000);
    strata[0].existing = strata[0].quota + 10;
    planTakes(strata, 90);

    expect(sum(strata.map((s) => s.take))).toBeLessThanOrEqual(90);
  });
});

describe("allocate", () => {
  it("respecte les plafonds et place tout ce qui peut l'être", () => {
    expect(allocate([1, 1, 1], [10, 10, 10], 9)).toEqual([3, 3, 3]);
    expect(sum(allocate([1, 1, 1], [1, 10, 10], 9))).toBe(9);
    expect(allocate([1, 1], [2, 2], 10)).toEqual([2, 2]);
  });

  it("ignore une strate de poids nul", () => {
    expect(allocate([1, 0], [10, 10], 4)).toEqual([4, 0]);
  });
});

describe("reachable", () => {
  it("plafonne le besoin par les candidats disponibles", () => {
    expect(reachable({ need: 10, available: 3 } as Stratum)).toBe(3);
    expect(reachable({ need: 2, available: 8 } as Stratum)).toBe(2);
  });
});
