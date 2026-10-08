import { Prisma } from "@/generated/prisma/client";
import { ContactMessageDirection } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import type { InboundMessage } from "@/utils/brevo-inbound";
import { createLogger } from "@/utils/logger";

const logger = createLogger("CRM Inbound");

export interface InboundPersistenceResult {
  created: number;
  skipped: number;
}

/**
 * Enregistre les messages entrants sur le contact correspondant à l'expéditeur.
 * Un expéditeur inconnu ou supprimé est ignoré : le CRM ne crée pas de contact
 * depuis un e-mail reçu.
 */
export async function persistInboundMessages(
  messages: InboundMessage[],
): Promise<InboundPersistenceResult> {
  const result: InboundPersistenceResult = { created: 0, skipped: 0 };

  for (const message of messages) {
    const contact = await prisma.contact.findFirst({
      where: { email: message.senderEmail, deletedAt: null },
      select: { id: true },
    });

    if (!contact) {
      result.skipped += 1;
      continue;
    }

    try {
      await prisma.contactMessage.create({
        data: {
          contactId: contact.id,
          direction: ContactMessageDirection.INBOUND,
          subject: message.subject,
          textContent: message.textContent,
          brevoMessageId: message.brevoMessageId,
        },
      });
      result.created += 1;
    } catch (error) {
      // L'idempotence repose sur la contrainte unique plutôt que sur un
      // findUnique préalable, qui laisserait une course entre deux rejeux.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        result.skipped += 1;
        continue;
      }
      throw error;
    }
  }

  logger.info("Messages entrants traités", { ...result });

  return result;
}
