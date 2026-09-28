import { MAX_EXTRACTED_LABEL_LENGTH } from "@/lib/ai/tag-axes";
import { GOLDEN_TAG_AXES } from "@/utils/golden-dataset-golden-tags";
import {
  canonicalTag,
  NO_BLOCKAGE_GOLDEN_TAG,
  OTHER_GOLDEN_TAG,
  sameTag,
  UNDETERMINED_GOLDEN_TAG,
} from "@/utils/golden-dataset-tag";
import {
  closedTagsOf,
  closedTaxonomyReport,
  projectAxis,
  projectCorpus,
  renderFineLabelPrompt,
  renderTaxonomyPrompt,
  validateTaxonomy,
  withExits,
  type ClosedTaxonomy,
} from "@/utils/golden-dataset-taxonomy";

// Une taxonomie jouet : la logique se teste ici, jamais sur la v1, dont
// trancher un arbitrage changerait les listes.
const BLOCKAGE = withExits([
  { tag: "retard", definition: "L'organisme tarde.", examples: ["trois mois"] },
  {
    tag: "pièce refusée",
    definition: "Une pièce est refusée.",
    examples: ["justificatif illisible"],
  },
  {
    tag: NO_BLOCKAGE_GOLDEN_TAG,
    definition: "Rien ne bloque.",
    examples: ["demande simple"],
  },
]);

const PROCEDURE = withExits([
  { tag: "RSA", definition: "Le RSA.", examples: ["demande de RSA"] },
  {
    tag: "carte vitale",
    definition: "La carte vitale.",
    examples: ["duplicata"],
  },
]);

interface TestTags {
  blockageTag: (typeof BLOCKAGE)[number]["tag"];
  procedureTag: (typeof PROCEDURE)[number]["tag"];
}

const TAXONOMY: ClosedTaxonomy<TestTags> = {
  version: 99,
  axes: { blockageTag: BLOCKAGE, procedureTag: PROCEDURE },
  projection: {
    blockageTag: [
      ["Délai anormal", "retard"],
      ["retard", "retard"],
      ["justificatif rejeté", "pièce refusée"],
      ["déménagement", OTHER_GOLDEN_TAG],
      [UNDETERMINED_GOLDEN_TAG, UNDETERMINED_GOLDEN_TAG],
    ],
    procedureTag: [
      ["demande rsa", "RSA"],
      ["demande carte vitale", "carte vitale"],
      [UNDETERMINED_GOLDEN_TAG, UNDETERMINED_GOLDEN_TAG],
    ],
  },
};

describe("validateTaxonomy", () => {
  it("ne signale rien sur une taxonomie bien formée", () => {
    expect(validateTaxonomy(TAXONOMY)).toEqual([]);
  });

  it("signale un axe sans exutoire", () => {
    const problems = validateTaxonomy({
      ...TAXONOMY,
      axes: {
        ...TAXONOMY.axes,
        blockageTag: [
          { tag: "retard", definition: "L'organisme tarde.", examples: [] },
        ],
      },
      projection: { ...TAXONOMY.projection, blockageTag: [] },
    });

    expect(problems).toEqual([
      `blockageTag : l'exutoire « ${OTHER_GOLDEN_TAG} » manque à la liste.`,
      `blockageTag : l'exutoire « ${UNDETERMINED_GOLDEN_TAG} » manque à la liste.`,
    ]);
  });

  it("signale deux tags d'un même axe équivalents à la casse près", () => {
    const problems = validateTaxonomy({
      ...TAXONOMY,
      axes: {
        ...TAXONOMY.axes,
        procedureTag: withExits([
          { tag: "RSA", definition: "Le RSA.", examples: [] },
          { tag: "rsa", definition: "Le RSA, écrit autrement.", examples: [] },
          { tag: "carte vitale", definition: "La carte vitale.", examples: [] },
        ]),
      },
    });

    expect(problems).toEqual([
      "procedureTag : les tags « RSA » et « rsa » sont le même tag.",
    ]);
  });

  it("signale deux labels fins équivalents visant deux tags différents", () => {
    const problems = validateTaxonomy({
      ...TAXONOMY,
      projection: {
        ...TAXONOMY.projection,
        blockageTag: [
          ...TAXONOMY.projection.blockageTag,
          ["Retard", "pièce refusée"],
        ],
      },
    });

    expect(problems).toEqual([
      "blockageTag : le label fin « Retard » vise « retard » et « pièce refusée ».",
    ]);
  });

  it("signale une entrée qui vise un tag hors de l'axe", () => {
    const problems = validateTaxonomy({
      ...TAXONOMY,
      projection: {
        ...TAXONOMY.projection,
        procedureTag: [
          ...TAXONOMY.projection.procedureTag,
          ["demande apl", "APL"],
        ],
      },
    });

    expect(problems).toEqual([
      "procedureTag : le label fin « demande apl » vise « APL », qui n'est pas un tag de l'axe.",
    ]);
  });

  it("signale un tag que la réponse du modèle ne rendrait pas intact", () => {
    const longTag =
      "demande de prise en charge des frais de transport pour un rendez-vous médical";
    const problems = validateTaxonomy({
      ...TAXONOMY,
      axes: {
        ...TAXONOMY.axes,
        procedureTag: withExits([
          { tag: "RSA", definition: "Le RSA.", examples: [] },
          { tag: "carte vitale", definition: "La carte vitale.", examples: [] },
          {
            tag: "APL/ALS",
            definition: "Les aides au logement.",
            examples: [],
          },
          { tag: longTag, definition: "Le transport médical.", examples: [] },
        ]),
      },
    });

    expect(problems).toEqual([
      "procedureTag : le tag « APL/ALS » serait lu « APL » dans la réponse du modèle.",
      `procedureTag : le tag « ${longTag} » serait écarté de la réponse du modèle (vide, ou plus de ${MAX_EXTRACTED_LABEL_LENGTH} caractères).`,
    ]);
  });
});

describe("renderTaxonomyPrompt", () => {
  const prompt = renderTaxonomyPrompt(TAXONOMY);

  it("donne chaque tag avec sa définition et ses exemples", () => {
    for (const axis of GOLDEN_TAG_AXES) {
      for (const { tag, definition, examples } of TAXONOMY.axes[axis]) {
        expect(prompt).toContain(tag);
        expect(prompt).toContain(definition);
        for (const example of examples) {
          expect(prompt).toContain(example);
        }
      }
    }
  });

  it("demande une réponse sur deux lignes, un tag par axe", () => {
    expect(prompt).toContain("BLOCAGE: <tag>\nDEMARCHE: <tag>");
  });

  it("ne livre aucun label fin de la projection, sauf ceux qui sont aussi des tags", () => {
    const canonicalPrompt = canonicalTag(prompt);

    for (const axis of GOLDEN_TAG_AXES) {
      const fineLabels = TAXONOMY.projection[axis]
        .map(([fineLabel]) => fineLabel)
        .filter(
          (fineLabel) =>
            !closedTagsOf(TAXONOMY, axis).some((tag) =>
              sameTag(tag, fineLabel),
            ),
        );

      for (const fineLabel of fineLabels) {
        expect(canonicalPrompt).not.toContain(canonicalTag(fineLabel));
      }
    }
  });
});

describe("closedTagsOf", () => {
  it("rend les tags de l'axe dans l'ordre de la liste", () => {
    expect(closedTagsOf(TAXONOMY, "procedureTag")).toEqual([
      "RSA",
      "carte vitale",
      OTHER_GOLDEN_TAG,
      UNDETERMINED_GOLDEN_TAG,
    ]);
  });
});

describe("projectAxis", () => {
  it("projette par équivalence sameTag, pas par égalité de texte", () => {
    expect(projectAxis(TAXONOMY, "blockageTag", "delai ANORMAL")).toEqual({
      kind: "projected",
      fineLabel: "delai ANORMAL",
      closedTag: "retard",
    });
  });

  it("ne projette jamais un gold fin null", () => {
    expect(projectAxis(TAXONOMY, "blockageTag", null)).toEqual({
      kind: "unadjudicated",
    });
  });

  it("refuse un label fin sans entrée plutôt que de le verser dans « autre »", () => {
    expect(projectAxis(TAXONOMY, "procedureTag", "demande apl")).toEqual({
      kind: "unmapped",
      fineLabel: "demande apl",
    });
  });

  it("projette « inconnu » par son entrée explicite, sur chaque axe", () => {
    expect(projectAxis(TAXONOMY, "procedureTag", "Inconnu")).toMatchObject({
      kind: "projected",
      closedTag: UNDETERMINED_GOLDEN_TAG,
    });
  });
});

describe("projectCorpus", () => {
  it("rend une ligne par item, avec son identifiant, quand tout se projette", () => {
    const result = projectCorpus(
      [
        {
          itemId: "item-2",
          position: 2,
          goldenBlockageTag: "inconnu",
          goldenProcedureTag: "demande carte vitale",
        },
        {
          itemId: "item-1",
          position: 1,
          goldenBlockageTag: "retard",
          goldenProcedureTag: "demande rsa",
        },
      ],
      TAXONOMY,
    );

    expect(result).toEqual({
      ok: true,
      rows: [
        {
          itemId: "item-1",
          position: 1,
          blockageTag: "retard",
          procedureTag: "RSA",
        },
        {
          itemId: "item-2",
          position: 2,
          blockageTag: UNDETERMINED_GOLDEN_TAG,
          procedureTag: "carte vitale",
        },
      ],
    });
  });

  it("refuse tout le corpus dès qu'un label manque ou qu'un item n'est pas adjugé, et dit lesquels", () => {
    const result = projectCorpus(
      [
        {
          itemId: "item-1",
          position: 1,
          goldenBlockageTag: "retard",
          goldenProcedureTag: "demande apl",
        },
        {
          itemId: "item-2",
          position: 2,
          goldenBlockageTag: "retard",
          goldenProcedureTag: "Demande APL",
        },
        {
          itemId: "item-3",
          position: 3,
          goldenBlockageTag: null,
          goldenProcedureTag: "demande rsa",
        },
      ],
      TAXONOMY,
    );

    expect(result).toEqual({
      ok: false,
      unmapped: [
        { axis: "procedureTag", fineLabel: "demande apl", positions: [1, 2] },
      ],
      unadjudicated: [3],
    });
  });
});

describe("closedTaxonomyReport", () => {
  it("compte la distribution même quand le corpus refuse, et marque les tags de domaine sous la barre", () => {
    const report = closedTaxonomyReport(
      [
        {
          position: 1,
          goldenBlockageTag: "retard",
          goldenProcedureTag: "demande apl",
          closedGolds: [],
        },
        {
          position: 2,
          goldenBlockageTag: "retard",
          goldenProcedureTag: null,
          closedGolds: [],
        },
      ],
      TAXONOMY,
    );

    expect(report.corpus.ok).toBe(false);
    expect(report.distribution.blockageTag).toEqual([
      { tag: "retard", count: 2, belowMinimum: true },
      { tag: "pièce refusée", count: 0, belowMinimum: true },
      { tag: NO_BLOCKAGE_GOLDEN_TAG, count: 0, belowMinimum: false },
      { tag: OTHER_GOLDEN_TAG, count: 0, belowMinimum: false },
      { tag: UNDETERMINED_GOLDEN_TAG, count: 0, belowMinimum: false },
    ]);
    expect(report.frozenRows).toBe(0);
  });

  it("signale la dérive d'un item dont le gold fin a bougé après le gel", () => {
    const report = closedTaxonomyReport(
      [
        {
          position: 1,
          goldenBlockageTag: "justificatif rejeté",
          goldenProcedureTag: "demande rsa",
          closedGolds: [
            {
              taxonomyVersion: 99,
              blockageTag: "retard",
              procedureTag: "RSA",
            },
          ],
        },
      ],
      TAXONOMY,
    );

    expect(report.items.get(1)?.driftedAxes).toEqual(["blockageTag"]);
    expect(report.frozenRows).toBe(1);
  });

  it("ne lit que la ligne figée de sa propre version", () => {
    const report = closedTaxonomyReport(
      [
        {
          position: 1,
          goldenBlockageTag: "retard",
          goldenProcedureTag: "demande rsa",
          closedGolds: [
            {
              taxonomyVersion: 98,
              blockageTag: "autre chose",
              procedureTag: "autre chose",
            },
          ],
        },
      ],
      TAXONOMY,
    );

    expect(report.items.get(1)?.stored).toBeNull();
    expect(report.items.get(1)?.driftedAxes).toEqual([]);
    expect(report.frozenRows).toBe(0);
  });
});

describe("renderFineLabelPrompt", () => {
  const prompt = renderFineLabelPrompt(TAXONOMY);

  it("donne chaque label fin adjugé sous son tag fermé", () => {
    for (const axis of GOLDEN_TAG_AXES) {
      for (const [fineLabel, closedTag] of TAXONOMY.projection[axis]) {
        if (sameTag(fineLabel, UNDETERMINED_GOLDEN_TAG)) continue;
        const line = prompt
          .split("\n")
          .find((candidate) => candidate.includes(`« ${fineLabel} »`));

        expect(line?.startsWith(`- ${closedTag} (`)).toBe(true);
      }
    }
  });

  it("demande une réponse sur deux lignes, un label par axe", () => {
    expect(prompt).toContain("BLOCAGE: <libellé>\nDEMARCHE: <libellé>");
  });
});
