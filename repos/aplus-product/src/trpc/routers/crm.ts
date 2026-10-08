import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma/client";
import { ContactMessageDirection } from "@/generated/prisma/enums";
import { adminProcedure, createTRPCRouter } from "../init";
import prisma from "@/lib/prisma";
import { sendEmail as sendTransactionalEmail } from "@/app/services/email/email.service";
import { checkRateLimit } from "@/lib/rate-limit";
import { searchWithUnaccent } from "@/utils/search";
import { normalizeEmail } from "@/utils/normalize";
import { createLogger } from "@/utils/logger";

const logger = createLogger("CRM");

// Une campagne d'envois admin en une séance tient dans 30 messages par heure :
// le plafond arrête une boucle emballée sans gêner l'usage réel.
const SEND_EMAIL_RATE_LIMIT = { max: 30, windowSeconds: 60 * 60 };

const AREA_SELECT = { id: true, name: true } as const;
const ORGANIZATION_SELECT = {
  id: true,
  name: true,
  shortName: true,
} as const;

const contactFields = {
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  address: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
};

const EMAIL_CONFLICT_MESSAGE =
  "Un contact utilise déjà cette adresse e-mail. Veuillez en saisir une autre.";

function isEmailConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export const crmRouter = createTRPCRouter({
  getContacts: adminProcedure
    .input(
      z
        .object({
          page: z.number().min(1).optional(),
          pageSize: z.number().min(1).max(100).optional(),
          search: z.string().optional(),
          sortBy: z.enum(["name", "email", "createdAt"]).optional(),
          sortOrder: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 10;
      const search = input?.search?.trim();
      const sortBy = input?.sortBy ?? "name";
      const sortOrder = input?.sortOrder ?? "asc";

      const matchingIds = search
        ? await searchWithUnaccent(
            "Contact",
            ["firstName", "lastName", "email"],
            search,
          )
        : null;

      const where: Prisma.ContactWhereInput = matchingIds
        ? { deletedAt: null, id: { in: matchingIds } }
        : { deletedAt: null };

      function getContactOrderBy():
        | Prisma.ContactOrderByWithRelationInput
        | Prisma.ContactOrderByWithRelationInput[] {
        switch (sortBy) {
          case "email":
            return { email: sortOrder };
          case "createdAt":
            return { createdAt: sortOrder };
          default:
            return [{ lastName: sortOrder }, { firstName: sortOrder }];
        }
      }

      const [items, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          orderBy: getContactOrderBy(),
          include: {
            area: { select: AREA_SELECT },
            organization: { select: ORGANIZATION_SELECT },
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.contact.count({ where }),
      ]);

      return {
        items,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  getContactById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const contact = await prisma.contact.findUnique({
        where: { id: input.id },
        include: {
          area: { select: AREA_SELECT },
          organization: { select: ORGANIZATION_SELECT },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              sentBy: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      if (!contact || contact.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce contact est introuvable.",
        });
      }

      return contact;
    }),

  createContact: adminProcedure
    .input(z.object(contactFields))
    .mutation(async ({ input }) => {
      try {
        return await prisma.contact.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            email: normalizeEmail(input.email),
            address: input.address,
            areaId: input.areaId,
            organizationId: input.organizationId,
          },
        });
      } catch (error) {
        if (isEmailConflict(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: EMAIL_CONFLICT_MESSAGE,
          });
        }
        throw error;
      }
    }),

  updateContact: adminProcedure
    .input(z.object({ id: z.string(), ...contactFields }))
    .mutation(async ({ input }) => {
      const existing = await prisma.contact.findFirst({
        where: { id: input.id, deletedAt: null },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce contact est introuvable.",
        });
      }

      try {
        // `?? null` et non `undefined` : un champ vidé par le formulaire doit
        // être effacé, alors que `undefined` laisserait l'ancienne valeur.
        return await prisma.contact.update({
          where: { id: input.id },
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            email: normalizeEmail(input.email),
            address: input.address ?? null,
            areaId: input.areaId ?? null,
            organizationId: input.organizationId ?? null,
          },
        });
      } catch (error) {
        if (isEmailConflict(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: EMAIL_CONFLICT_MESSAGE,
          });
        }
        throw error;
      }
    }),

  deleteContact: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const contact = await prisma.contact.findUnique({
        where: { id: input.id },
        select: { deletedAt: true },
      });

      if (!contact || contact.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce contact est introuvable.",
        });
      }

      await prisma.contact.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });

      return { success: true };
    }),

  sendEmail: adminProcedure
    .input(
      z.object({
        contactId: z.string(),
        subject: z.string().min(1).max(255),
        content: z.string().min(1).max(10000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimit = await checkRateLimit(
        "crm:sendEmail",
        ctx.userId,
        SEND_EMAIL_RATE_LIMIT,
      );
      if (!rateLimit.allowed) {
        const retryAfterMinutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Vous avez envoyé trop de messages. Veuillez réessayer dans ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? "s" : ""}.`,
        });
      }

      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId, deletedAt: null },
      });

      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ce contact est introuvable.",
        });
      }

      // Enregistré avant l'envoi : un échec d'écriture après un envoi réussi
      // pousserait l'admin à renvoyer, donc à doubler l'e-mail.
      const message = await prisma.contactMessage.create({
        data: {
          contactId: contact.id,
          direction: ContactMessageDirection.OUTBOUND,
          subject: input.subject,
          textContent: input.content,
          sentById: ctx.user.id,
        },
      });

      const inboundEmail = process.env.CRM_INBOUND_EMAIL;

      const result = await sendTransactionalEmail({
        to: [
          {
            email: contact.email,
            name: `${contact.firstName} ${contact.lastName}`.trim(),
          },
        ],
        subject: input.subject,
        textContent: input.content,
        ...(inboundEmail ? { replyTo: { email: inboundEmail } } : {}),
      });

      if (!result.success) {
        await prisma.contactMessage.delete({ where: { id: message.id } });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Une erreur est survenue lors de l'envoi du message. Veuillez réessayer.",
        });
      }

      try {
        await prisma.contactMessage.update({
          where: { id: message.id },
          data: { brevoMessageId: result.messageId },
        });
      } catch (error) {
        logger.error("Identifiant Brevo non enregistré", {
          contactMessageId: message.id,
          error,
        });
      }

      return { success: true };
    }),
});
