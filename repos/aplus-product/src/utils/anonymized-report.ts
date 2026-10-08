import { ROUTE } from "@/app/constant/route";
import type { GoldenTagAxis } from "@/utils/golden-dataset-golden-tags";
import {
  NO_BLOCKAGE_GOLDEN_TAG,
  OTHER_GOLDEN_TAG,
  sameTag,
  UNDETERMINED_GOLDEN_TAG,
} from "@/utils/golden-dataset-tag";
import { CURRENT_GOLDEN_TAXONOMY } from "@/utils/golden-dataset-taxonomy-current";
import type { StoredTags } from "@/utils/report-tagging";

export const ANONYMIZED_REPORTS_PAGE_SIZE = 20;

function isExit(label: string): boolean {
  return (
    sameTag(label, OTHER_GOLDEN_TAG) || sameTag(label, UNDETERMINED_GOLDEN_TAG)
  );
}

/**
 * Graphie adjugée du libellé stocké, qui peut n'en différer que par la casse
 * ou les accents. Les exutoires ne disent rien du signalement : `null`.
 */
export function teamLabelOf(
  axis: GoldenTagAxis,
  rawLabel: string | null,
): string | null {
  if (rawLabel === null || isExit(rawLabel)) {
    return null;
  }
  if (axis === "blockageTag" && sameTag(rawLabel, NO_BLOCKAGE_GOLDEN_TAG)) {
    return NO_BLOCKAGE_GOLDEN_TAG;
  }

  const entry = CURRENT_GOLDEN_TAXONOMY.projection[axis].find(([fineLabel]) =>
    sameTag(fineLabel, rawLabel),
  );

  return entry?.[0] ?? null;
}

export interface DisplayedTagging {
  procedureLabel: string | null;
  blockageLabel: string | null;
}

export const NO_TAGGING: DisplayedTagging = {
  procedureLabel: null,
  blockageLabel: null,
};

export function displayedTaggingOf(
  tagging: Pick<StoredTags, "procedureLabel" | "blockageLabel">,
): DisplayedTagging {
  return {
    procedureLabel: teamLabelOf("procedureTag", tagging.procedureLabel),
    blockageLabel: teamLabelOf("blockageTag", tagging.blockageLabel),
  };
}

export interface TeamLabelOptions {
  main: readonly string[];
  /** Les tags créés par l'équipe hors liste, que la projection range sous « autre ». */
  others: readonly string[];
}

function teamLabelOptions(axis: GoldenTagAxis): TeamLabelOptions {
  const projection = CURRENT_GOLDEN_TAXONOMY.projection[axis];

  function labelsUnder(closedTag: string): string[] {
    const labels: string[] = [];
    for (const [fineLabel, projected] of projection) {
      if (
        sameTag(projected, closedTag) &&
        !isExit(fineLabel) &&
        !labels.some((label) => sameTag(label, fineLabel))
      ) {
        labels.push(fineLabel);
      }
    }
    return labels;
  }

  return {
    main: CURRENT_GOLDEN_TAXONOMY.axes[axis].flatMap(({ tag }) => {
      if (isExit(tag)) {
        return [];
      }
      // « aucun » n'a pas de label fin : le tag fermé est lui-même la réponse.
      return sameTag(tag, NO_BLOCKAGE_GOLDEN_TAG) ? [tag] : labelsUnder(tag);
    }),
    others: labelsUnder(OTHER_GOLDEN_TAG),
  };
}

export const ANONYMIZED_REPORT_FILTER_OPTIONS: Record<
  GoldenTagAxis,
  TeamLabelOptions
> = {
  procedureTag: teamLabelOptions("procedureTag"),
  blockageTag: teamLabelOptions("blockageTag"),
};

export const ANONYMIZED_REPORT_FILTER_LABELS: Record<
  GoldenTagAxis,
  readonly string[]
> = {
  procedureTag: [
    ...ANONYMIZED_REPORT_FILTER_OPTIONS.procedureTag.main,
    ...ANONYMIZED_REPORT_FILTER_OPTIONS.procedureTag.others,
  ],
  blockageTag: [
    ...ANONYMIZED_REPORT_FILTER_OPTIONS.blockageTag.main,
    ...ANONYMIZED_REPORT_FILTER_OPTIONS.blockageTag.others,
  ],
};

/** Les valeurs stockées qui s'écrivent comme le libellé demandé, à la graphie près. */
export function storedVariantsOf(
  teamLabel: string,
  storedLabels: readonly (string | null)[],
): string[] {
  return storedLabels.filter((stored): stored is string =>
    sameTag(stored, teamLabel),
  );
}

export const ANSWER_SIDE = {
  APPLICANT: "applicant",
  OPERATOR: "operator",
} as const;

export type AnswerSide = (typeof ANSWER_SIDE)[keyof typeof ANSWER_SIDE];

export const ANSWER_SIDE_LABEL: Record<AnswerSide, string> = {
  applicant: "Aidant",
  operator: "Équipe opératrice",
};

interface ReportAuthorship {
  authorId: string;
  coAuthorIds: readonly string[];
}

export function answerSide(
  answerAuthorId: string,
  report: ReportAuthorship,
): AnswerSide {
  return answerAuthorId === report.authorId ||
    report.coAuthorIds.includes(answerAuthorId)
    ? ANSWER_SIDE.APPLICANT
    : ANSWER_SIDE.OPERATOR;
}

interface AuthorTeam {
  id: string;
  organization: { name: string; shortName: string };
}

/**
 * Opérateur au nom duquel une réponse a été écrite : `Answer` ne stocke pas
 * l'équipe, on prend celle de l'auteur qui est destinataire du signalement.
 */
export function answerOperator(
  authorTeams: readonly AuthorTeam[],
  requestedTeamIds: readonly string[],
): string | null {
  const team = authorTeams.find((authorTeam) =>
    requestedTeamIds.includes(authorTeam.id),
  );
  if (!team) {
    return null;
  }
  return team.organization.shortName || team.organization.name;
}

export interface AnonymizedReportSearch {
  page: number;
  /** Nom court de l'organisation destinataire, ex. `CAF`. */
  operator?: string;
  /** Montre aussi les signalements jamais étiquetés, masqués par défaut. */
  includeUntagged?: boolean;
  procedureLabel?: string;
  blockageLabel?: string;
  id?: string;
}

const OPERATOR_SEARCH_KEY = "operateur";
const INCLUDE_UNTAGGED_SEARCH_KEY = "tous";
const PROCEDURE_SEARCH_KEY = "demarche";
const BLOCKAGE_SEARCH_KEY = "blocage";

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function teamLabelParam(
  raw: string | string[] | undefined,
  axis: GoldenTagAxis,
): string | undefined {
  const label = firstValue(raw);
  return label !== undefined &&
    ANONYMIZED_REPORT_FILTER_LABELS[axis].includes(label)
    ? label
    : undefined;
}

/**
 * L'URL se modifie à la main : une valeur invalide est ignorée plutôt que
 * transmise au routeur, qui la rejetterait et ferait échouer la page.
 */
export function parseAnonymizedReportSearch(
  params: RawSearchParams,
): AnonymizedReportSearch {
  const page = Number(firstValue(params.page));
  const id = firstValue(params.id);
  const operator = firstValue(params[OPERATOR_SEARCH_KEY]);

  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    operator: operator ? operator : undefined,
    includeUntagged:
      firstValue(params[INCLUDE_UNTAGGED_SEARCH_KEY]) === "1" || undefined,
    procedureLabel: teamLabelParam(
      params[PROCEDURE_SEARCH_KEY],
      "procedureTag",
    ),
    blockageLabel: teamLabelParam(params[BLOCKAGE_SEARCH_KEY], "blockageTag"),
    id: id ? id : undefined,
  };
}

export function anonymizedReportsHref(search: AnonymizedReportSearch): string {
  const params = new URLSearchParams();
  if (search.page > 1) params.set("page", String(search.page));
  if (search.operator) params.set(OPERATOR_SEARCH_KEY, search.operator);
  if (search.includeUntagged) params.set(INCLUDE_UNTAGGED_SEARCH_KEY, "1");
  if (search.procedureLabel) {
    params.set(PROCEDURE_SEARCH_KEY, search.procedureLabel);
  }
  if (search.blockageLabel) {
    params.set(BLOCKAGE_SEARCH_KEY, search.blockageLabel);
  }
  if (search.id) params.set("id", search.id);

  const query = params.toString();
  return query
    ? `${ROUTE.ANONYMIZED_REPORTS}?${query}`
    : ROUTE.ANONYMIZED_REPORTS;
}
