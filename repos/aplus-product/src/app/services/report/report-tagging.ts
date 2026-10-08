import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { toBlindItem } from "@/lib/ai/golden-dataset/blind-item";
import {
  GOLDEN_TAG_USER_TEMPLATE,
  goldenTagStep,
  promptHash,
  selectSystemPrompt,
  type GoldenTagRecipe,
} from "@/lib/ai/golden-dataset/golden-tag";
import {
  PIPELINE_ERROR_KINDS,
  classifyPipelineError,
} from "@/lib/ai/pipeline-error";
import { mapWithConcurrency } from "@/utils/concurrency";
import { CURRENT_GOLDEN_TAXONOMY } from "@/utils/golden-dataset-taxonomy-current";
import {
  NEWEST_FIRST,
  nextCursor,
  olderThan,
  type NewestFirstCursor,
} from "@/utils/keyset-pagination";
import { createLogger } from "@/utils/logger";
import {
  isExhausted,
  recordOutcome,
  reserveCall,
  type PipelineBudget,
} from "@/utils/pipeline-budget";
import {
  organizationLabel,
  reportTaggingRecipeKey,
  storedTags,
} from "@/utils/report-tagging";

const logger = createLogger("Report Tagging");

const BATCH_SIZE = 50;

/** Une requête par signalement ; le reste du quota journalier va au caviardage. */
export const TAGGING_CALLS_PER_RUN = 12_000;

/** Trois de front : le run chevauche souvent le caviardage, qui puise dans les mêmes 100 requêtes/min. */
const TAGGING_CONCURRENCY = 3;

/** Température de la recette validée sur le golden dataset. */
const TAGGING_TEMPERATURE = 0.2;

export interface ReportTaggingResult {
  /** `null` : aucun modèle configuré, l'étiquetage n'a pas tourné. */
  model: string | null;
  tagged: number;
  refused: number;
  errors: { reportId: string; error: string }[];
}

export interface TaggingRecipe {
  recipe: GoldenTagRecipe;
  recipeKey: string;
}

/** La recette validée à l'examen : labels fins, rangés par tag fermé. */
export function taggingRecipe(model: string): TaggingRecipe {
  const { systemPrompt, taxonomyVersion } = selectSystemPrompt("fine");
  return {
    recipe: { model, systemPrompt, temperature: TAGGING_TEMPERATURE },
    recipeKey: reportTaggingRecipeKey({
      model,
      promptHash: promptHash(systemPrompt, GOLDEN_TAG_USER_TEMPLATE),
      temperature: TAGGING_TEMPERATURE,
      taxonomyVersion: taxonomyVersion ?? CURRENT_GOLDEN_TAXONOMY.version,
    }),
  };
}

/** Seule la copie pseudonymisée est lue : le texte réel n'est jamais chargé. */
export const TAGGING_REPORT_SELECT = {
  id: true,
  pseudonymized: { select: { subject: true, description: true } },
  requestedTeams: {
    select: { organization: { select: { shortName: true } } },
  },
} satisfies Prisma.ReportSelect;

type TaggingReportPayload = Prisma.ReportGetPayload<{
  select: typeof TAGGING_REPORT_SELECT;
}>;

export interface PseudonymizedTaggableReport extends TaggingReportPayload {
  pseudonymized: NonNullable<TaggingReportPayload["pseudonymized"]>;
}

/** Un appel au modèle, puis l'écriture des étiquettes ; jamais réécrites en cas de course. */
export async function tagReport(
  prisma: PrismaClient,
  report: PseudonymizedTaggableReport,
  { recipe, recipeKey }: TaggingRecipe,
): Promise<void> {
  const item = toBlindItem({
    id: report.id,
    organization: organizationLabel(
      report.requestedTeams.map((team) => team.organization.shortName),
    ),
    subject: report.pseudonymized.subject,
    description: report.pseudonymized.description,
  });
  const output = await goldenTagStep.run({ item, recipe });

  await prisma.reportTagging.upsert({
    where: { reportId_recipeKey: { reportId: report.id, recipeKey } },
    create: { reportId: report.id, recipeKey, ...storedTags(output) },
    update: {},
  });
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Étiquette les signalements pseudonymisés jamais étiquetés : changer de modèle
 * ne relance pas les autres. Le modèle ne voit jamais les réponses, comme les annotateurs.
 */
export async function tagReports(
  prisma: PrismaClient,
  budget: PipelineBudget,
  model: string | undefined,
): Promise<ReportTaggingResult> {
  const result: ReportTaggingResult = {
    model: model ?? null,
    tagged: 0,
    refused: 0,
    errors: [],
  };
  if (!model) {
    logger.info("ALBERT_MODEL absente : étiquetage ignoré");
    return result;
  }

  const tagging = taggingRecipe(model);
  let cursor: NewestFirstCursor | null = null;

  while (!isExhausted(budget)) {
    const page = await prisma.report.findMany({
      where: {
        AND: [
          { taggings: { none: {} } },
          { pseudonymized: { isNot: null } },
          olderThan(cursor),
        ],
      },
      select: { ...TAGGING_REPORT_SELECT, createdAt: true },
      orderBy: NEWEST_FIRST,
      take: BATCH_SIZE,
    });
    if (page.length === 0) break;
    cursor = nextCursor(page);

    await mapWithConcurrency(page, TAGGING_CONCURRENCY, async (report) => {
      const { pseudonymized } = report;
      if (!pseudonymized || !reserveCall(budget)) return;

      try {
        await tagReport(prisma, { ...report, pseudonymized }, tagging);
        recordOutcome(budget, false);
        result.tagged += 1;
      } catch (error) {
        const kind = classifyPipelineError(error);
        if (kind === PIPELINE_ERROR_KINDS.OUTAGE) {
          recordOutcome(budget, true);
          return;
        }
        if (kind === PIPELINE_ERROR_KINDS.REFUSED) {
          recordOutcome(budget, false);
          result.refused += 1;
          return;
        }
        result.errors.push({ reportId: report.id, error: toMessage(error) });
        logger.error("Erreur d'étiquetage", { reportId: report.id, error });
      }
    });
  }

  return result;
}
