import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { GoldenTagAxis } from "@/utils/golden-dataset-golden-tags";
import {
  ANONYMIZED_REPORT_FILTER_LABELS,
  ANONYMIZED_REPORTS_PAGE_SIZE,
  answerOperator,
  answerSide,
  ANSWER_SIDE,
  type DisplayedTagging,
  displayedTaggingOf,
  NO_TAGGING,
  storedVariantsOf,
} from "@/utils/anonymized-report";

function teamLabelSchema(axis: GoldenTagAxis) {
  return z
    .string()
    .refine(
      (value) => ANONYMIZED_REPORT_FILTER_LABELS[axis].includes(value),
      "Libellé inconnu.",
    );
}

type LabelColumn = "procedureLabel" | "blockageLabel";

// Toutes recettes confondues : les étiquettes d'un ancien modèle restent filtrables.
async function storedVariants(
  column: LabelColumn,
  teamLabel: string,
): Promise<string[]> {
  const rows = await prisma.reportTagging.findMany({
    distinct: [column],
    select: { procedureLabel: true, blockageLabel: true },
  });

  return storedVariantsOf(
    teamLabel,
    rows.map((row) => row[column]),
  );
}

/** `null` quand aucune ligne ne peut correspondre : inutile d'interroger les signalements. */
async function labelCondition(
  column: LabelColumn,
  teamLabel: string | undefined,
): Promise<Prisma.ReportTaggingWhereInput | null> {
  if (teamLabel === undefined) {
    return {};
  }

  const variants = await storedVariants(column, teamLabel);
  return variants.length === 0 ? null : { [column]: { in: variants } };
}

/** Le plus récent l'emporte quand un signalement a plusieurs étiquetages. */
async function taggingByReportId(
  reportIds: string[],
): Promise<Map<string, DisplayedTagging>> {
  if (reportIds.length === 0) {
    return new Map();
  }

  const taggings = await prisma.reportTagging.findMany({
    where: { reportId: { in: reportIds } },
    orderBy: { createdAt: "asc" },
    select: {
      reportId: true,
      procedureLabel: true,
      blockageLabel: true,
    },
  });

  return new Map(
    taggings.map((tagging) => [tagging.reportId, displayedTaggingOf(tagging)]),
  );
}

// Un auteur désactivé a quitté ses équipes : elles ne survivent que dans son
// instantané de désactivation, sans lequel 95 % des réponses n'auraient pas d'opérateur.
const AUTHOR_TEAM_SELECT = {
  id: true,
  organization: { select: { name: true, shortName: true } },
} as const;

const EMPTY_PAGE = {
  total: 0,
  pageSize: ANONYMIZED_REPORTS_PAGE_SIZE,
  items: [],
};

// Seuls les textes pseudonymisés sortent : les champs en clair du signalement,
// des réponses et du citoyen ne sont jamais sélectionnés.
export const anonymizedReportRouter = createTRPCRouter({
  /** Organisations destinataires d'au moins un signalement anonymisé. */
  operators: adminProcedure.query(() =>
    prisma.organization.findMany({
      where: {
        teams: {
          some: { reports: { some: { pseudonymized: { isNot: null } } } },
        },
      },
      orderBy: { shortName: "asc" },
      select: { shortName: true, name: true },
    }),
  ),

  list: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1),
        operator: z.string().min(1).optional(),
        includeUntagged: z.boolean().optional(),
        procedureLabel: teamLabelSchema("procedureTag").optional(),
        blockageLabel: teamLabelSchema("blockageTag").optional(),
      }),
    )
    .query(async ({ input }) => {
      const filtered =
        input.procedureLabel !== undefined || input.blockageLabel !== undefined;

      let where: Prisma.ReportWhereInput = { pseudonymized: { isNot: null } };

      if (input.operator !== undefined) {
        where = {
          ...where,
          requestedTeams: {
            some: { organization: { shortName: input.operator } },
          },
        };
      }

      if (filtered) {
        const [procedure, blockage] = await Promise.all([
          labelCondition("procedureLabel", input.procedureLabel),
          labelCondition("blockageLabel", input.blockageLabel),
        ]);
        if (procedure === null || blockage === null) {
          return EMPTY_PAGE;
        }

        where = {
          ...where,
          taggings: { some: { ...procedure, ...blockage } },
        };
      } else if (!input.includeUntagged) {
        where = { ...where, taggings: { some: {} } };
      }

      // Hors transaction : son délai de 5 s faisait échouer la page sur une base au cache froid.
      const [total, reports] = await Promise.all([
        prisma.report.count({ where }),
        prisma.report.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (input.page - 1) * ANONYMIZED_REPORTS_PAGE_SIZE,
          take: ANONYMIZED_REPORTS_PAGE_SIZE,
          select: {
            id: true,
            createdAt: true,
            pseudonymized: { select: { subject: true } },
          },
        }),
      ]);

      const taggings = await taggingByReportId(
        reports.map((report) => report.id),
      );

      return {
        total,
        pageSize: ANONYMIZED_REPORTS_PAGE_SIZE,
        items: reports.flatMap((report) =>
          report.pseudonymized
            ? [
                {
                  id: report.id,
                  createdAt: report.createdAt,
                  subject: report.pseudonymized.subject,
                  ...(taggings.get(report.id) ?? NO_TAGGING),
                },
              ]
            : [],
        ),
      };
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const report = await prisma.report.findFirst({
        where: { id: input.id, pseudonymized: { isNot: null } },
        select: {
          id: true,
          createdAt: true,
          authorId: true,
          coAuthors: { select: { id: true } },
          requestedTeams: {
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
          pseudonymized: { select: { subject: true, description: true } },
          answers: {
            where: { isMetadataOnly: false, pseudonymized: { isNot: null } },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              createdAt: true,
              authorId: true,
              author: {
                select: {
                  teams: { select: AUTHOR_TEAM_SELECT },
                  deactivatedTeamSnapshot: {
                    select: { teams: { select: AUTHOR_TEAM_SELECT } },
                  },
                },
              },
              pseudonymized: { select: { content: true } },
            },
          },
        },
      });

      if (!report?.pseudonymized) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Signalement anonymisé introuvable.",
        });
      }

      const taggings = await taggingByReportId([report.id]);
      const authorship = {
        authorId: report.authorId,
        coAuthorIds: report.coAuthors.map((coAuthor) => coAuthor.id),
      };
      const requestedTeamIds = report.requestedTeams.map((team) => team.id);

      return {
        id: report.id,
        createdAt: report.createdAt,
        subject: report.pseudonymized.subject,
        description: report.pseudonymized.description,
        requestedTeams: report.requestedTeams.map((team) => team.name),
        ...(taggings.get(report.id) ?? NO_TAGGING),
        answers: report.answers.flatMap((answer) => {
          if (!answer.pseudonymized) {
            return [];
          }
          const side = answerSide(answer.authorId, authorship);
          return [
            {
              id: answer.id,
              createdAt: answer.createdAt,
              content: answer.pseudonymized.content,
              side,
              operator:
                side === ANSWER_SIDE.OPERATOR
                  ? answerOperator(
                      [
                        ...answer.author.teams,
                        ...(answer.author.deactivatedTeamSnapshot?.teams ?? []),
                      ],
                      requestedTeamIds,
                    )
                  : null,
            },
          ];
        }),
      };
    }),
});
