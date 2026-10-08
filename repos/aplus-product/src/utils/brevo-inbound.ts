import { z } from "zod";
import { normalizeEmail } from "@/utils/normalize";

/**
 * Message entrant normalisé : produit une seule fois à la frontière Brevo, pour
 * que le code en aval ignore les variantes de champs du fournisseur.
 */
export interface InboundMessage {
  senderEmail: string;
  subject: string;
  textContent: string;
  brevoMessageId: string;
}

const FALLBACK_SUBJECT = "(sans objet)";

// Schéma de frontière externe : chaque champ retombe sur `undefined` plutôt que
// de faire échouer l'item, un champ malformé ne devant pas perdre les autres.
const itemSchema = z.object({
  From: z
    .object({ Address: z.string().optional(), Name: z.string().optional() })
    .optional()
    .catch(undefined),
  Sender: z
    .union([z.string(), z.object({ Address: z.string().optional() })])
    .optional()
    .catch(undefined),
  Subject: z.string().optional().catch(undefined),
  RawTextBody: z.string().optional().catch(undefined),
  ExtractedMarkdownMessage: z.string().optional().catch(undefined),
  MessageId: z.string().optional().catch(undefined),
});

// Même plafond que /api/analytics/batch : borne la charge d'un seul appel.
const payloadSchema = z.object({ items: z.array(z.unknown()).max(100) });

type BrevoInboundItem = z.infer<typeof itemSchema>;

function extractSenderAddress(item: BrevoInboundItem): string {
  if (item.From?.Address) return item.From.Address;
  if (typeof item.Sender === "string") return item.Sender;
  return item.Sender?.Address ?? "";
}

function toInboundMessage(item: BrevoInboundItem): InboundMessage | null {
  const senderEmail = normalizeEmail(extractSenderAddress(item));

  // Sans expéditeur ni identifiant, le message n'est ni rattachable à un
  // contact ni idempotent : on l'écarte au lieu de faire échouer le lot.
  if (!senderEmail || !item.MessageId) return null;

  return {
    senderEmail,
    subject: item.Subject || FALLBACK_SUBJECT,
    textContent: item.RawTextBody || item.ExtractedMarkdownMessage || "",
    brevoMessageId: item.MessageId,
  };
}

/**
 * Transforme un payload « inbound parsing » Brevo en messages exploitables.
 * Retourne `null` quand le payload n'a pas du tout la forme attendue, seul cas
 * où l'appelant doit répondre 400.
 */
export function parseBrevoInboundPayload(
  payload: unknown,
): InboundMessage[] | null {
  const parsedPayload = payloadSchema.safeParse(payload);
  if (!parsedPayload.success) return null;

  const messages: InboundMessage[] = [];

  for (const rawItem of parsedPayload.data.items) {
    const parsedItem = itemSchema.safeParse(rawItem);
    if (!parsedItem.success) continue;

    const message = toInboundMessage(parsedItem.data);
    if (message) messages.push(message);
  }

  return messages;
}
