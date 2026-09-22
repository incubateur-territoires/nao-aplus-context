import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import { USER_ROLES } from "@/constants/user-roles";
import { validateAnnotationTag } from "@/utils/golden-dataset-tag";
import {
  GOLDEN_TAG_COLUMNS,
  unanimousFills,
} from "@/utils/golden-dataset-adjudication";

const positionSchema = z.number().int().min(1);

const annotationTagSchema = z
  .string()
  .nullish()
  .transform((raw, ctx) => {
    const result = validateAnnotationTag(raw);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
      return z.NEVER;
    }
    return result.value;
  });

const hasAtLeastOneTag = {
  OR: [{ blockageTag: { not: null } }, { procedureTag: { not: null } }],
};

export const goldenDatasetRouter = createTRPCRouter({
  getItem: adminProcedure
    .input(z.object({ position: positionSchema }))
    .query(async ({ input, ctx }) => {
      const annotatorId = ctx.user.id;

      const [total, item, annotated, annotators] = await prisma.$transaction([
        prisma.goldenDatasetItem.count(),
        prisma.goldenDatasetItem.findUnique({
          where: { position: input.position },
          select: {
            subject: true,
            description: true,
            organization: true,
            annotations: {
              where: { annotatorId },
              select: { blockageTag: true, procedureTag: true },
            },
          },
        }),
        prisma.goldenDatasetAnnotation.findMany({
          where: { annotatorId, ...hasAtLeastOneTag },
          select: { item: { select: { position: true } } },
          orderBy: { item: { position: "asc" } },
        }),
        // Les annotateurs sont ceux qui ont déjà posé un tag, plus l'appelant :
        // lister tous les comptes admin afficherait des « 0 » pour des gens qui
        // ne participent pas.
        prisma.user.findMany({
          where: {
            OR: [
              { id: annotatorId },
              { goldenDatasetAnnotations: { some: hasAtLeastOneTag } },
            ],
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            _count: {
              select: { goldenDatasetAnnotations: { where: hasAtLeastOneTag } },
            },
          },
        }),
      ]);

      if (total === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Le corpus n'a pas encore été constitué.",
        });
      }

      if (input.position > total) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Le corpus ne compte que ${total} signalements.`,
        });
      }

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce signalement du corpus est introuvable.",
        });
      }

      const annotation = item.annotations[0];

      return {
        total,
        position: input.position,
        item: {
          subject: item.subject,
          description: item.description,
          organization: item.organization,
        },
        annotation: annotation
          ? {
              blockageTag: annotation.blockageTag,
              procedureTag: annotation.procedureTag,
            }
          : null,
        annotatedPositions: annotated.map((entry) => entry.item.position),
        currentAnnotatorId: annotatorId,
        progress: annotators
          .map((user) => ({
            annotatorId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            annotated: user._count.goldenDatasetAnnotations,
          }))
          .sort(
            (a, b) =>
              b.annotated - a.annotated ||
              a.firstName.localeCompare(b.firstName, "fr"),
          ),
      };
    }),

  saveAnnotation: adminProcedure
    .input(
      z.object({
        position: positionSchema,
        blockageTag: annotationTagSchema,
        procedureTag: annotationTagSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const item = await prisma.goldenDatasetItem.findUnique({
        where: { position: input.position },
        select: { id: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce signalement du corpus est introuvable.",
        });
      }

      const annotatorId = ctx.user.id;

      await prisma.goldenDatasetAnnotation.upsert({
        where: { itemId_annotatorId: { itemId: item.id, annotatorId } },
        create: {
          itemId: item.id,
          annotatorId,
          blockageTag: input.blockageTag,
          procedureTag: input.procedureTag,
        },
        update: {
          blockageTag: input.blockageTag,
          procedureTag: input.procedureTag,
        },
      });

      return { success: true };
    }),

  // Le label retenu est un texte et non une référence à l'annotation qui le
  // portait : plusieurs sources peuvent proposer le même, et le corpus de
  // référence n'a pas à dépendre de qui l'a écrit en premier. L'appelant
  // envoie l'état complet des deux axes, comme `saveAnnotation`, ce qui rend
  // un rejeu sans effet supplémentaire.
  chooseGoldenTags: adminProcedure
    .input(
      z.object({
        position: positionSchema,
        blockageTag: annotationTagSchema,
        procedureTag: annotationTagSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const item = await prisma.goldenDatasetItem.findUnique({
        where: { position: input.position },
        select: { id: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce signalement du corpus est introuvable.",
        });
      }

      await prisma.goldenDatasetItem.update({
        where: { position: input.position },
        data: {
          goldenBlockageTag: input.blockageTag,
          goldenProcedureTag: input.procedureTag,
        },
      });

      return { success: true };
    }),

  // Ne remplit que les axes encore vides : un label tranché à la main pendant
  // la réunion ne doit pas être effacé par un clic sur le bouton. La règle vit
  // dans `unanimousFills` et nulle part ailleurs, une seconde règle ici
  // finirait par diverger de celle qu'affiche le client.
  //
  // Sans écriture à produire, la mutation ne touche pas la base du tout, ce qui
  // rend un rejeu strictement sans effet plutôt que sans effet visible.
  adjudicateUnanimous: adminProcedure.mutation(async () => {
    const items = await prisma.goldenDatasetItem.findMany({
      // L'ordre de position fixe l'ordre des écritures de la transaction.
      orderBy: { position: "asc" },
      select: {
        id: true,
        goldenBlockageTag: true,
        goldenProcedureTag: true,
        annotations: {
          where: hasAtLeastOneTag,
          select: { blockageTag: true, procedureTag: true },
        },
      },
    });

    const writes = items.flatMap((item) =>
      unanimousFills(item).map((fill) => ({
        id: item.id,
        column: GOLDEN_TAG_COLUMNS[fill.axis],
        tag: fill.tag,
      })),
    );

    if (writes.length === 0) {
      return { filled: 0 };
    }

    // Chaque axe part dans son propre updateMany conditionné à la nullité de
    // sa colonne : un axe retenu à la main par un chooseGoldenTags concurrent
    // entre le findMany et la transaction n'est ni écrasé ni compté.
    const written = await prisma.$transaction(
      writes.map((write) =>
        prisma.goldenDatasetItem.updateMany({
          where: { id: write.id, [write.column]: null },
          data: { [write.column]: write.tag },
        }),
      ),
    );

    return {
      filled: written.reduce((total, result) => total + result.count, 0),
    };
  }),

  overview: adminProcedure.query(async () => {
    const [total, annotators, runs, items] = await prisma.$transaction([
      prisma.goldenDatasetItem.count(),
      // Tous les admins en activité, pour que la restitution montre aussi qui
      // n'a pas encore commencé. La seconde branche rattrape un compte devenu
      // inactif après avoir annoté : sans elle, ses annotations existeraient
      // toujours en base mais ne s'afficheraient plus nulle part.
      prisma.user.findMany({
        where: {
          OR: [
            { role: USER_ROLES.ADMIN, isInactive: null, deletedAt: null },
            { goldenDatasetAnnotations: { some: hasAtLeastOneTag } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          _count: {
            select: { goldenDatasetAnnotations: { where: hasAtLeastOneTag } },
          },
        },
      }),
      // Symétrie du filtre `hasAtLeastOneTag` appliqué aux humains : une série
      // créée mais dont aucune prédiction n'est encore écrite n'ajouterait
      // qu'une colonne entièrement vide. Le prédicat n'est pas le même pour
      // autant : une prédiction écrite sans aucun tag est un résultat, le
      // modèle a répondu et n'a rien produit, là où une annotation sans tag ne
      // dit rien de plus qu'une absence.
      //
      // L'ordre est celui de la création, pour que la première série lancée
      // reste la première colonne et que les colonnes ne se déplacent pas d'un
      // chargement à l'autre.
      prisma.goldenDatasetRun.findMany({
        where: { predictions: { some: {} } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          model: true,
          temperature: true,
          _count: { select: { predictions: true } },
        },
      }),
      prisma.goldenDatasetItem.findMany({
        orderBy: { position: "asc" },
        select: {
          position: true,
          organization: true,
          subject: true,
          description: true,
          goldenBlockageTag: true,
          goldenProcedureTag: true,
          annotations: {
            where: hasAtLeastOneTag,
            // Identifier l'annotateur par son id et non par son prénom : trois
            // comptes admin s'appellent Charles, et regrouper par prénom
            // attribuait les annotations de l'un à l'autre.
            select: {
              annotatorId: true,
              blockageTag: true,
              procedureTag: true,
            },
          },
          predictions: {
            select: { runId: true, blockageTag: true, procedureTag: true },
          },
        },
      }),
    ]);

    return {
      total,
      annotators: annotators
        .map((user) => ({
          annotatorId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          annotated: user._count.goldenDatasetAnnotations,
        }))
        .sort(
          (a, b) =>
            b.annotated - a.annotated ||
            a.firstName.localeCompare(b.firstName, "fr") ||
            a.lastName.localeCompare(b.lastName, "fr"),
        ),
      runs: runs.map((run) => ({
        runId: run.id,
        model: run.model,
        temperature: run.temperature,
        predicted: run._count.predictions,
      })),
      items: items.map((item) => ({
        position: item.position,
        organization: item.organization,
        subject: item.subject,
        description: item.description,
        goldenBlockageTag: item.goldenBlockageTag,
        goldenProcedureTag: item.goldenProcedureTag,
        annotations: item.annotations.map((annotation) => ({
          annotatorId: annotation.annotatorId,
          blockageTag: annotation.blockageTag,
          procedureTag: annotation.procedureTag,
        })),
        predictions: item.predictions.map((prediction) => ({
          runId: prediction.runId,
          blockageTag: prediction.blockageTag,
          procedureTag: prediction.procedureTag,
        })),
      })),
    };
  }),
});
