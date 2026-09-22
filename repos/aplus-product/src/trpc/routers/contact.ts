import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, createTRPCRouter } from "../init";
import { sendEmail } from "@/app/services/email/email.service";
import { checkRateLimit } from "@/lib/rate-limit";

// Garde-fous serveur pour les pièces jointes : le formulaire est public, on ne
// fait donc pas confiance aux limites appliquées côté client (InputFile).
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENTS_TOTAL_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];

const contactAttachment = z.object({
  // Contenu encodé en base64, tel qu'attendu par l'API Brevo.
  name: z.string().min(1).max(255),
  content: z.string().min(1),
});

const contactInput = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  team: z.string().optional(),
  subject: z.string().min(1),
  message: z.string().min(1),
  attachments: z.array(contactAttachment).max(MAX_ATTACHMENTS).default([]),
});

// Une chaîne base64 représente ~3/4 de sa longueur en octets.
function approximateBase64Bytes(content: string): number {
  return Math.floor((content.length * 3) / 4);
}

// Dedicated, stricter limit than the global public-mutation limit: a contact
// form should not be usable to send more than a handful of messages per hour.
const CONTACT_RATE_LIMIT = { max: 5, windowSeconds: 60 * 60 };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const contactRouter = createTRPCRouter({
  send: publicProcedure.input(contactInput).mutation(async ({ input, ctx }) => {
    const rateLimitKey = ctx.userId ?? ctx.requestContext?.ipAddress;
    if (rateLimitKey) {
      const rateLimit = await checkRateLimit(
        "contact:send",
        rateLimitKey,
        CONTACT_RATE_LIMIT,
      );
      if (!rateLimit.allowed) {
        const retryAfterMinutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Vous avez envoyé trop de messages. Veuillez réessayer dans ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? "s" : ""}.`,
        });
      }
    }

    const invalidAttachment = input.attachments.find(
      (attachment) =>
        !ALLOWED_ATTACHMENT_EXTENSIONS.some((ext) =>
          attachment.name.toLowerCase().endsWith(ext),
        ),
    );
    if (invalidAttachment) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Format de pièce jointe non supporté. Formats acceptés : jpg, png, pdf.",
      });
    }

    const totalAttachmentsBytes = input.attachments.reduce(
      (total, attachment) => total + approximateBase64Bytes(attachment.content),
      0,
    );
    if (totalAttachmentsBytes > MAX_ATTACHMENTS_TOTAL_BYTES) {
      throw new TRPCError({
        code: "PAYLOAD_TOO_LARGE",
        message:
          "La taille totale des pièces jointes dépasse la limite autorisée (5 Mo).",
      });
    }

    const recipient =
      process.env.CONTACT_RECIPIENT_EMAIL ?? process.env.BREVO_SENDER_EMAIL;

    if (!recipient) {
      console.error(
        "Contact form: no recipient configured (CONTACT_RECIPIENT_EMAIL / BREVO_SENDER_EMAIL)",
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "L'envoi du message est temporairement indisponible. Veuillez réessayer plus tard.",
      });
    }

    const fullName = `${input.firstName} ${input.lastName}`.trim();
    const team = input.team?.trim();
    const subject = input.subject.trim();
    const attachmentCount = input.attachments.length;
    const attachmentNames = input.attachments
      .map((attachment) => attachment.name)
      .join(", ");
    const attachmentLabel =
      attachmentCount > 0
        ? `${attachmentCount} pièce${attachmentCount > 1 ? "s" : ""} jointe${attachmentCount > 1 ? "s" : ""} : ${attachmentNames}`
        : null;

    // We use the default verified Brevo sender and set replyTo to the contact's
    // email so the support team can answer them directly.
    const result = await sendEmail({
      to: [{ email: recipient }],
      subject: `[Contact A+] ${subject} — ${fullName}`,
      replyTo: { email: input.email, name: fullName },
      htmlContent: `
        <p><strong>Nom :</strong> ${escapeHtml(fullName)}</p>
        <p><strong>Adresse e-mail :</strong> ${escapeHtml(input.email)}</p>
        ${team ? `<p><strong>Équipe concernée :</strong> ${escapeHtml(team)}</p>` : ""}
        <p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>
        ${attachmentLabel ? `<p><strong>${escapeHtml(attachmentLabel)}</strong></p>` : ""}
        <p><strong>Message :</strong></p>
        <p>${escapeHtml(input.message).replace(/\n/g, "<br />")}</p>
      `,
      textContent: [
        `Nom : ${fullName}`,
        `Adresse e-mail : ${input.email}`,
        team ? `Équipe concernée : ${team}` : null,
        `Sujet : ${subject}`,
        attachmentLabel,
        "",
        input.message,
      ]
        .filter((line) => line !== null)
        .join("\n"),
      attachment:
        input.attachments.length > 0
          ? input.attachments.map((attachment) => ({
              name: attachment.name,
              content: attachment.content,
            }))
          : undefined,
    });

    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Une erreur est survenue lors de l'envoi de votre message. Veuillez réessayer.",
      });
    }

    return { success: true };
  }),
});
