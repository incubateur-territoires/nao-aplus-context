import {
  extractAxisValues,
  MAX_EXTRACTED_LABEL_LENGTH,
  type TagAxis,
} from "@/lib/ai/tag-axes";
import {
  GOLDEN_TAG_AXES,
  type GoldenTagAxis,
} from "@/utils/golden-dataset-golden-tags";
import {
  canonicalTag,
  NO_BLOCKAGE_GOLDEN_TAG,
  OTHER_GOLDEN_TAG,
  sameTag,
  UNDETERMINED_GOLDEN_TAG,
} from "@/utils/golden-dataset-tag";

/**
 * Ce qu'est une taxonomie fermée et comment elle s'applique aux labels de
 * référence adjugés. Les deux vivent ensemble parce qu'ils protègent la même
 * décision : une projection n'a de sens que pour la liste qu'elle vise.
 *
 * Les listes vivent dans `golden-dataset-taxonomy-v<N>.ts`, que ce module
 * n'importe jamais ; la version en cours est désignée par
 * `golden-dataset-taxonomy-current.ts`.
 */

/** Sous ce nombre d'items, aucun score par tag ne se calcule. Règle du guide. */
export const MIN_ITEMS_PER_TAG = 3;

export interface ClosedTagDefinition<Tag extends string = string> {
  readonly tag: Tag;
  /** Une ligne, celle qui partira telle quelle dans la consigne du modèle. */
  readonly definition: string;
  readonly examples: readonly string[];
}

export const OTHER_DEFINITION = {
  tag: OTHER_GOLDEN_TAG,
  definition: "L'axe est déterminable mais aucun tag de la liste ne convient.",
  examples: [],
} as const satisfies ClosedTagDefinition;

export const UNDETERMINED_DEFINITION = {
  tag: UNDETERMINED_GOLDEN_TAG,
  definition: "Le signalement ne permet pas de trancher cet axe.",
  examples: ["un texte trop court pour conclure"],
} as const satisfies ClosedTagDefinition;

export type ExitTag = typeof OTHER_GOLDEN_TAG | typeof UNDETERMINED_GOLDEN_TAG;

export type ClosedAxis<Tag extends string = string> =
  readonly ClosedTagDefinition<Tag>[];

export type ClosedTagOf<Axis extends ClosedAxis> = Axis[number]["tag"];

/**
 * Les deux exutoires s'ajoutent par construction, jamais recopiés dans un
 * fichier de version. `validateTaxonomy` vérifie qu'ils sont bien là.
 */
export function withExits<Tag extends string>(
  domain: ClosedAxis<Tag>,
): ClosedAxis<Tag | ExitTag> {
  return [...domain, OTHER_DEFINITION, UNDETERMINED_DEFINITION];
}

/**
 * Le tag fermé de chaque axe, en union littérale. C'est ce paramètre qui fait
 * qu'une entrée de projection vers un tag hors liste ne compile pas, et qu'un
 * tag de démarche ne peut pas être écrit dans `blockageTag`.
 */
export type ClosedTagSet = Record<GoldenTagAxis, string>;

/**
 * `[label fin tel qu'adjugé, tag fermé]`. La clé effective est
 * `canonicalTag(label fin)` : la graphie écrite ici n'a pas à être canonique.
 */
export type FineLabelMapping<Tag extends string> = readonly [
  fineLabel: string,
  closedTag: Tag,
];

export interface ClosedTaxonomy<Tags extends ClosedTagSet = ClosedTagSet> {
  readonly version: number;
  readonly axes: { readonly [A in GoldenTagAxis]: ClosedAxis<Tags[A]> };
  /**
   * Totale sur les golds fins adjugés, et explicite : un label absent n'est
   * pas versé dans « autre », il fait refuser la projection.
   */
  readonly projection: {
    readonly [A in GoldenTagAxis]: readonly FineLabelMapping<Tags[A]>[];
  };
}

/** Les deux tags fermés d'un item, jamais `null` : la forme d'une ligne figée. */
export type ClosedGolds<Tags extends ClosedTagSet = ClosedTagSet> = {
  readonly [A in GoldenTagAxis]: Tags[A];
};

export function closedTagsOf<
  Tags extends ClosedTagSet,
  A extends GoldenTagAxis,
>(taxonomy: ClosedTaxonomy<Tags>, axis: A): readonly Tags[A][] {
  return taxonomy.axes[axis].map((entry) => entry.tag);
}

interface PromptAxis {
  /** Clé sous laquelle `extractAxisValues` lit la ligne de réponse. */
  readonly tagAxis: TagAxis;
  readonly description: string;
}

const PROMPT_AXES: Record<GoldenTagAxis, PromptAxis> = {
  blockageTag: {
    tagAxis: "blocage",
    description: "la cause concrète qui empêche la situation d'avancer",
  },
  procedureTag: {
    tagAxis: "demarche",
    description: "la prestation ou la procédure concernée",
  },
};

function heading(axis: GoldenTagAxis): string {
  return PROMPT_AXES[axis].tagAxis.toUpperCase();
}

function answerLine(axis: GoldenTagAxis, value: string): string {
  return `${heading(axis)}: ${value}`;
}

function tagEntry({ tag, definition, examples }: ClosedTagDefinition): string {
  const entry = `- « ${tag} » : ${definition}`;
  if (examples.length === 0) {
    return entry;
  }

  const label = examples.length === 1 ? "Exemple" : "Exemples";

  return `${entry}\n  ${label} : ${examples.join(" ; ")}`;
}

// Consigne v2 puis v3 (exemples) : sur la mise au point, le modèle ne s'abstenait jamais sur le
// blocage alors que l'équipe l'avait jugé indéterminable dans la majorité des cas.
const UNDETERMINED_BLOCKAGE_RULE = `- Sur l'axe ${heading("blockageTag")}, réponds « ${UNDETERMINED_GOLDEN_TAG} » dès que le texte décrit la demande ou la situation sans dire ce qui l'empêche d'avancer. Ne déduis pas le blocage de la démarche : c'est la réponse attendue pour une bonne partie des signalements.
  Exemples inventés :
  « [NOM_1] souhaite connaître l'état de son dossier de retraite déposé il y a trois mois. » → ${heading("blockageTag")}: ${UNDETERMINED_GOLDEN_TAG}
  « [NOM_1] demande un rendez-vous pour faire le point sur ses droits au RSA. » → ${heading("blockageTag")}: ${UNDETERMINED_GOLDEN_TAG}
  « [NOM_1] ne reçoit plus les codes de connexion car il n'a plus accès à sa boîte mail. » → le blocage est dit : on le tague.`;

/**
 * La consigne « liste fermée » décrit la liste, pas l'histoire des labels fins :
 * le `Pick` lui interdit de lire la projection.
 */
export function renderTaxonomyPrompt(
  taxonomy: Pick<ClosedTaxonomy, "axes">,
): string {
  // Les deux premières lignes recopient à dessein le texte libre au lieu de le
  // partager : retoucher celle-ci ne doit pas changer le hash de ses séries.
  const framing = [
    "Tu es un annotateur d'Administration+, service public d'aide au déblocage de situations administratives complexes.",
    "On te donne un signalement déjà pseudonymisé : les données personnelles sont remplacées par des jetons comme [NOM_1] ou [NUMERO_1].",
    "Ta tâche : poser exactement deux tags, un par axe, chacun choisi dans la liste de cet axe.",
  ].join("\n");

  const axisBlocks = GOLDEN_TAG_AXES.map((axis) =>
    [
      `${heading(axis)} : ${PROMPT_AXES[axis].description}.`,
      "Tags possibles :",
      ...taxonomy.axes[axis].map(tagEntry),
    ].join("\n"),
  );

  const rules = [
    "Règles impératives :",
    "- Un seul tag par axe, recopié tel quel depuis la liste de cet axe.",
    `- « ${UNDETERMINED_GOLDEN_TAG} » quand le signalement ne permet pas de trancher l'axe.`,
    UNDETERMINED_BLOCKAGE_RULE,
    `- « ${OTHER_GOLDEN_TAG} » quand l'axe se tranche mais qu'aucun tag de sa liste ne convient.`,
    `- « ${NO_BLOCKAGE_GOLDEN_TAG} » n'existe que sur l'axe ${heading("blockageTag")}, quand rien n'empêche la situation d'avancer.`,
    "- Réponds UNIQUEMENT sur deux lignes, sans introduction ni commentaire :",
    ...GOLDEN_TAG_AXES.map((axis) => answerLine(axis, "<tag>")),
  ].join("\n");

  return [framing, ...axisBlocks, rules].join("\n\n");
}

/**
 * Menu des labels fins adjugés, rangés sous leur tag fermé : le modèle choisit
 * un label fin et le tag fermé se déduit de la projection. Lit donc la
 * projection, à l'inverse de `renderTaxonomyPrompt`.
 */
export function renderFineLabelPrompt(taxonomy: ClosedTaxonomy): string {
  const framing = [
    "Tu es un annotateur d'Administration+, service public d'aide au déblocage de situations administratives complexes.",
    "On te donne un signalement déjà pseudonymisé : les données personnelles sont remplacées par des jetons comme [NOM_1] ou [NUMERO_1].",
    "Ta tâche : poser exactement deux libellés, un par axe, chacun choisi dans la liste de cet axe. Les libellés sont rangés par catégorie pour t'aider à t'y retrouver.",
  ].join("\n");

  const axisBlocks = GOLDEN_TAG_AXES.map((axis) => {
    const categories = taxonomy.axes[axis].flatMap(({ tag, definition }) => {
      const fineLabels = taxonomy.projection[axis]
        .filter(
          ([fineLabel, closedTag]) =>
            closedTag === tag && !sameTag(fineLabel, UNDETERMINED_GOLDEN_TAG),
        )
        .map(([fineLabel]) => `« ${fineLabel} »`);

      return fineLabels.length === 0
        ? []
        : [`- ${tag} (${definition}) : ${fineLabels.join(" ; ")}`];
    });

    return [
      `${heading(axis)} : ${PROMPT_AXES[axis].description}.`,
      "Libellés possibles, par catégorie :",
      ...categories,
    ].join("\n");
  });

  const rules = [
    "Règles impératives :",
    "- Un seul libellé par axe, recopié tel quel depuis la liste de cet axe, jamais le nom d'une catégorie.",
    `- « ${UNDETERMINED_GOLDEN_TAG} » quand le signalement ne permet pas de trancher l'axe.`,
    UNDETERMINED_BLOCKAGE_RULE,
    `- « ${OTHER_GOLDEN_TAG} » quand l'axe se tranche mais qu'aucun libellé de sa liste ne convient.`,
    `- « ${NO_BLOCKAGE_GOLDEN_TAG} » n'existe que sur l'axe ${heading("blockageTag")}, quand rien n'empêche la situation d'avancer.`,
    "- Réponds UNIQUEMENT sur deux lignes, sans introduction ni commentaire :",
    ...GOLDEN_TAG_AXES.map((axis) => answerLine(axis, "<libellé>")),
  ].join("\n");

  return [framing, ...axisBlocks, rules].join("\n\n");
}

function isMeasurableTag(tag: string): boolean {
  return ![
    OTHER_GOLDEN_TAG,
    UNDETERMINED_GOLDEN_TAG,
    NO_BLOCKAGE_GOLDEN_TAG,
  ].some((exit) => sameTag(tag, exit));
}

/**
 * Ce que le type ne peut pas dire : un exutoire oublié, un tag que le parseur
 * ne relirait pas intact dans la réponse du modèle, deux tags équivalents au
 * sens `sameTag`, deux labels fins équivalents visant deux tags différents.
 * Vide pour une taxonomie valide ; le spec de chaque version l'affirme.
 */
export function validateTaxonomy(taxonomy: ClosedTaxonomy): readonly string[] {
  const problems: string[] = [];

  for (const axis of GOLDEN_TAG_AXES) {
    const definitions = taxonomy.axes[axis];
    const tags = definitions.map((definition) => definition.tag);

    for (const exit of [OTHER_GOLDEN_TAG, UNDETERMINED_GOLDEN_TAG]) {
      if (!tags.some((tag) => sameTag(tag, exit))) {
        problems.push(`${axis} : l'exutoire « ${exit} » manque à la liste.`);
      }
    }

    for (const tag of tags) {
      const read = extractAxisValues(answerLine(axis, tag)).get(
        PROMPT_AXES[axis].tagAxis,
      );
      if (read === tag) {
        continue;
      }
      problems.push(
        read === undefined
          ? `${axis} : le tag « ${tag} » serait écarté de la réponse du modèle (vide, ou plus de ${MAX_EXTRACTED_LABEL_LENGTH} caractères).`
          : `${axis} : le tag « ${tag} » serait lu « ${read} » dans la réponse du modèle.`,
      );
    }

    const seenTags = new Map<string, string>();
    for (const tag of tags) {
      const key = canonicalTag(tag);
      const previous = seenTags.get(key);
      if (previous === undefined) {
        seenTags.set(key, tag);
        continue;
      }
      problems.push(
        `${axis} : les tags « ${previous} » et « ${tag} » sont le même tag.`,
      );
    }

    const seenLabels = new Map<string, FineLabelMapping<string>>();
    for (const entry of taxonomy.projection[axis]) {
      const [fineLabel, closedTag] = entry;

      if (!tags.some((tag) => sameTag(tag, closedTag))) {
        problems.push(
          `${axis} : le label fin « ${fineLabel} » vise « ${closedTag} », qui n'est pas un tag de l'axe.`,
        );
      }

      const key = canonicalTag(fineLabel);
      const previous = seenLabels.get(key);
      if (previous === undefined) {
        seenLabels.set(key, entry);
        continue;
      }
      if (!sameTag(previous[1], closedTag)) {
        problems.push(
          `${axis} : le label fin « ${fineLabel} » vise « ${previous[1]} » et « ${closedTag} ».`,
        );
      }
    }
  }

  return problems;
}

/** Les colonnes gold fin d'un item, telles que le routeur les lit. */
export interface ProjectableItem {
  readonly position: number;
  readonly goldenBlockageTag: string | null;
  readonly goldenProcedureTag: string | null;
}

/** Ce qu'il faut en plus pour écrire une ligne : l'item, pas sa position. */
export interface IdentifiedItem extends ProjectableItem {
  readonly itemId: string;
}

export type AxisProjection<Tag extends string> =
  | {
      readonly kind: "projected";
      readonly fineLabel: string;
      readonly closedTag: Tag;
    }
  /** Gold fin `null` : personne n'a tranché, il n'y a rien à projeter. */
  | { readonly kind: "unadjudicated" }
  /** Gold fin adjugé sans entrée dans la projection : la version n'est pas prête. */
  | { readonly kind: "unmapped"; readonly fineLabel: string };

export function projectAxis<Tags extends ClosedTagSet, A extends GoldenTagAxis>(
  taxonomy: ClosedTaxonomy<Tags>,
  axis: A,
  fineLabel: string | null,
): AxisProjection<Tags[A]> {
  if (fineLabel === null) {
    return { kind: "unadjudicated" };
  }

  const entry = taxonomy.projection[axis].find(([label]) =>
    sameTag(label, fineLabel),
  );

  return entry === undefined
    ? { kind: "unmapped", fineLabel }
    : { kind: "projected", fineLabel, closedTag: entry[1] };
}

/** La ligne stockée dans `GoldenDatasetGold`, telle que `overview` la renvoie. */
export interface StoredClosedGolds extends ClosedGolds {
  readonly taxonomyVersion: number;
}

export type DerivedGolds<Tags extends ClosedTagSet = ClosedTagSet> = {
  readonly [A in GoldenTagAxis]: AxisProjection<Tags[A]>;
};

export interface ItemProjection<Tags extends ClosedTagSet = ClosedTagSet> {
  readonly position: number;
  readonly derived: DerivedGolds<Tags>;
  /** La ligne figée pour cette version, s'il y en a une. */
  readonly stored: StoredClosedGolds | null;
  /**
   * Axes où la ligne figée ne dit plus ce que la projection dérive : un gold
   * fin a bougé après le gel. Signal qu'une v2 se prépare, jamais une raison
   * de réécrire la ligne.
   */
  readonly driftedAxes: readonly GoldenTagAxis[];
}

export function projectItem<Tags extends ClosedTagSet>(
  item: ProjectableItem & {
    readonly closedGolds?: readonly StoredClosedGolds[];
  },
  taxonomy: ClosedTaxonomy<Tags>,
): ItemProjection<Tags> {
  const derived = {
    blockageTag: projectAxis(taxonomy, "blockageTag", item.goldenBlockageTag),
    procedureTag: projectAxis(
      taxonomy,
      "procedureTag",
      item.goldenProcedureTag,
    ),
  };

  const stored =
    item.closedGolds?.find(
      (golds) => golds.taxonomyVersion === taxonomy.version,
    ) ?? null;

  const driftedAxes =
    stored === null
      ? []
      : GOLDEN_TAG_AXES.filter((axis) => {
          const projection = derived[axis];

          return (
            projection.kind !== "projected" ||
            projection.closedTag !== stored[axis]
          );
        });

  return { position: item.position, derived, stored, driftedAxes };
}

export interface ClosedGoldRow<
  Tags extends ClosedTagSet = ClosedTagSet,
> extends ClosedGolds<Tags> {
  readonly itemId: string;
  readonly position: number;
}

export interface UnmappedLabel {
  readonly axis: GoldenTagAxis;
  /** Première graphie rencontrée ; les autres lui sont `sameTag`. */
  readonly fineLabel: string;
  readonly positions: readonly number[];
}

export interface CorpusGaps {
  readonly unmapped: readonly UnmappedLabel[];
  readonly unadjudicated: readonly number[];
}

/** Ce que la page a besoin de savoir : le gel passe, ou voici ce qui manque. */
export type CorpusVerdict =
  | { readonly ok: true }
  | ({ readonly ok: false } & CorpusGaps);

/**
 * Tout le corpus ou rien. Une ligne figée ne se complète jamais (pas de
 * `null`, pas de mise à jour), donc un item non adjugé ne peut être ni écrit
 * en partie ni ajouté plus tard : il bloque le gel, avec les labels sans
 * entrée.
 */
export type CorpusProjection<Tags extends ClosedTagSet = ClosedTagSet> =
  | { readonly ok: true; readonly rows: readonly ClosedGoldRow<Tags>[] }
  | ({ readonly ok: false } & CorpusGaps);

function byPosition(a: ProjectableItem, b: ProjectableItem): number {
  return a.position - b.position;
}

function collectGaps<Tags extends ClosedTagSet>(
  projections: readonly ItemProjection<Tags>[],
): CorpusGaps {
  const unmapped: UnmappedLabel[] = [];
  const grouped = new Map<string, number[]>();

  for (const axis of GOLDEN_TAG_AXES) {
    for (const projection of projections) {
      const derived = projection.derived[axis];
      if (derived.kind !== "unmapped") {
        continue;
      }

      const key = `${axis}\u0000${canonicalTag(derived.fineLabel)}`;
      const positions = grouped.get(key);
      if (positions === undefined) {
        const started = [projection.position];
        grouped.set(key, started);
        unmapped.push({
          axis,
          fineLabel: derived.fineLabel,
          positions: started,
        });
        continue;
      }
      positions.push(projection.position);
    }
  }

  const unadjudicated = projections
    .filter((projection) =>
      GOLDEN_TAG_AXES.some(
        (axis) => projection.derived[axis].kind === "unadjudicated",
      ),
    )
    .map((projection) => projection.position);

  return { unmapped, unadjudicated };
}

function verdictOf(gaps: CorpusGaps): CorpusVerdict {
  return gaps.unmapped.length === 0 && gaps.unadjudicated.length === 0
    ? { ok: true }
    : { ok: false, ...gaps };
}

function closedGoldsOf<Tags extends ClosedTagSet>(
  derived: DerivedGolds<Tags>,
): ClosedGolds<Tags> | null {
  const { blockageTag, procedureTag } = derived;

  return blockageTag.kind === "projected" && procedureTag.kind === "projected"
    ? {
        blockageTag: blockageTag.closedTag,
        procedureTag: procedureTag.closedTag,
      }
    : null;
}

export function projectCorpus<Tags extends ClosedTagSet>(
  items: readonly IdentifiedItem[],
  taxonomy: ClosedTaxonomy<Tags>,
): CorpusProjection<Tags> {
  const ordered = [...items].sort(byPosition);
  const projections: ItemProjection<Tags>[] = [];
  const rows: ClosedGoldRow<Tags>[] = [];

  for (const item of ordered) {
    const projection = projectItem(item, taxonomy);
    projections.push(projection);

    const closed = closedGoldsOf(projection.derived);
    if (closed !== null) {
      rows.push({ itemId: item.itemId, position: item.position, ...closed });
    }
  }

  const verdict = verdictOf(collectGaps(projections));

  return verdict.ok ? { ok: true, rows } : verdict;
}

export interface TagCount {
  readonly tag: string;
  readonly count: number;
  /** Tag de domaine sous `MIN_ITEMS_PER_TAG` : non mesurable, à arbitrer. */
  readonly belowMinimum: boolean;
}

export type TagDistribution = {
  readonly [A in GoldenTagAxis]: readonly TagCount[];
};

export interface ClosedTaxonomyReport<
  Tags extends ClosedTagSet = ClosedTagSet,
> {
  readonly version: number;
  /** Une entrée par item du corpus, par position. */
  readonly items: ReadonlyMap<number, ItemProjection<Tags>>;
  readonly corpus: CorpusVerdict;
  /**
   * Comptée même quand le corpus refuse : c'est pendant les arbitrages, donc
   * avant que tout se projette, qu'on a besoin de savoir quels tags passent
   * la barre.
   */
  readonly distribution: TagDistribution;
  /** 0 tant que la version n'est pas figée, `total` ensuite ; jamais entre. */
  readonly frozenRows: number;
}

function distributionOf<Tags extends ClosedTagSet, A extends GoldenTagAxis>(
  projections: readonly ItemProjection<Tags>[],
  taxonomy: ClosedTaxonomy<Tags>,
  axis: A,
): readonly TagCount[] {
  return taxonomy.axes[axis].map((definition) => {
    const count = projections.filter((projection) => {
      const derived = projection.derived[axis];

      return (
        derived.kind === "projected" && derived.closedTag === definition.tag
      );
    }).length;

    return {
      tag: definition.tag,
      count,
      belowMinimum:
        isMeasurableTag(definition.tag) && count < MIN_ITEMS_PER_TAG,
    };
  });
}

export function closedTaxonomyReport<Tags extends ClosedTagSet>(
  items: readonly (ProjectableItem & {
    readonly closedGolds: readonly StoredClosedGolds[];
  })[],
  taxonomy: ClosedTaxonomy<Tags>,
): ClosedTaxonomyReport<Tags> {
  const projections = [...items]
    .sort(byPosition)
    .map((item) => projectItem(item, taxonomy));

  return {
    version: taxonomy.version,
    items: new Map(
      projections.map((projection) => [projection.position, projection]),
    ),
    corpus: verdictOf(collectGaps(projections)),
    distribution: {
      blockageTag: distributionOf(projections, taxonomy, "blockageTag"),
      procedureTag: distributionOf(projections, taxonomy, "procedureTag"),
    },
    frozenRows: projections.filter((projection) => projection.stored !== null)
      .length,
  };
}
