import {
  GOLDEN_SPLIT_V1,
  GOLDEN_SPLITS,
  parseSplitSelection,
  splitCorpus,
  type GoldenSplitAssignment,
  type SplittableItem,
} from "./golden-dataset-split";

const COMPOSITION: ReadonlyArray<[organization: string, count: number]> = [
  ["CPAM", 38],
  ["CAF", 19],
  ["CARSAT", 17],
  ["CNAV", 9],
  ["MSA", 5],
  ["DDFIP", 5],
  ["Préf", 2],
  ["France Travail", 2],
  ["URSSAF", 1],
  ["Chèque énergie", 1],
  ["ANTS", 1],
];

function syntheticCorpus(): SplittableItem[] {
  let position = 0;
  return COMPOSITION.flatMap(([organization, count]) =>
    Array.from({ length: count }, () => {
      position++;
      return {
        id: `item-${String(position).padStart(3, "0")}`,
        organization,
      };
    }),
  );
}

function tuningIds(assignment: GoldenSplitAssignment): string[] {
  return [...assignment.entries()]
    .filter(([, split]) => split === GOLDEN_SPLITS.TUNING)
    .map(([id]) => id)
    .sort();
}

function tuningByOrganization(
  items: readonly SplittableItem[],
  assignment: GoldenSplitAssignment,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (assignment.get(item.id) === GOLDEN_SPLITS.TUNING) {
      counts[item.organization] = (counts[item.organization] ?? 0) + 1;
    }
  }
  return counts;
}

describe("splitCorpus", () => {
  const corpus = syntheticCorpus();

  it("met exactement 30 items en mise au point et le reste à l'examen", () => {
    const assignment = splitCorpus(corpus);

    expect(assignment.size).toBe(100);
    expect(tuningIds(assignment)).toHaveLength(30);
  });

  it("rend le même tirage à chaque appel", () => {
    expect(tuningIds(splitCorpus(corpus))).toEqual(
      tuningIds(splitCorpus(corpus)),
    );
  });

  it("ne dépend pas de l'ordre d'entrée", () => {
    const reversed = [...corpus].reverse();
    const interleaved = [
      ...corpus.filter((_, i) => i % 2 === 1),
      ...corpus.filter((_, i) => i % 2 === 0),
    ];

    expect(tuningIds(splitCorpus(reversed))).toEqual(
      tuningIds(splitCorpus(corpus)),
    );
    expect(tuningIds(splitCorpus(interleaved))).toEqual(
      tuningIds(splitCorpus(corpus)),
    );
  });

  it("répartit la mise au point par organisme au prorata du corpus", () => {
    const counts = tuningByOrganization(corpus, splitCorpus(corpus));

    for (const [organization, count] of COMPOSITION) {
      const exact = (count * 30) / 100;
      const taken = counts[organization] ?? 0;
      expect(taken).toBeGreaterThanOrEqual(Math.floor(exact));
      expect(taken).toBeLessThanOrEqual(Math.ceil(exact));
    }
    expect(counts).toEqual({
      CPAM: 11,
      CAF: 6,
      CARSAT: 5,
      CNAV: 3,
      DDFIP: 2,
      MSA: 1,
      Préf: 1,
      "France Travail": 1,
    });
  });

  it("change de tirage avec la graine", () => {
    const other = splitCorpus(corpus, { ...GOLDEN_SPLIT_V1, seed: "autre" });

    expect(tuningIds(other)).not.toEqual(tuningIds(splitCorpus(corpus)));
  });

  it("met tout en mise au point quand le corpus est plus petit que la cible", () => {
    const assignment = splitCorpus(corpus.slice(0, 12));

    expect(tuningIds(assignment)).toHaveLength(12);
  });

  // Filet contre un changement involontaire du tirage : si ce test casse, la
  // mise au point déjà regardée ne correspond plus à celle du code.
  it("fige le tirage v1 sur le corpus synthétique", () => {
    expect(tuningIds(splitCorpus(corpus))).toEqual(FROZEN_V1_TUNING);
  });
});

const FROZEN_V1_TUNING: string[] = [
  "item-004",
  "item-005",
  "item-007",
  "item-013",
  "item-017",
  "item-022",
  "item-027",
  "item-028",
  "item-029",
  "item-036",
  "item-037",
  "item-041",
  "item-043",
  "item-044",
  "item-045",
  "item-048",
  "item-049",
  "item-059",
  "item-066",
  "item-070",
  "item-071",
  "item-073",
  "item-076",
  "item-080",
  "item-082",
  "item-085",
  "item-089",
  "item-092",
  "item-094",
  "item-097",
];

describe("parseSplitSelection", () => {
  it("vise la mise au point sans variable", () => {
    expect(parseSplitSelection(undefined)).toBe(GOLDEN_SPLITS.TUNING);
  });

  it("accepte tuning et test", () => {
    expect(parseSplitSelection("tuning")).toBe(GOLDEN_SPLITS.TUNING);
    expect(parseSplitSelection("test")).toBe(GOLDEN_SPLITS.TEST);
  });

  it.each(["", "TEST", "examen", " tuning"])("refuse « %s »", (raw) => {
    expect(() => parseSplitSelection(raw)).toThrow(/SPLIT/);
  });
});
