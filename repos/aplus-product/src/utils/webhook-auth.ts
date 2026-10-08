import crypto from "crypto";

/**
 * Compare en temps constant le token présenté par un webhook entrant au secret
 * attendu. Le token voyage en paramètre de requête (`?token=`) et non dans un
 * en-tête : Brevo ne permet pas d'en-tête personnalisé sur ses webhooks.
 */
export function validateWebhookToken(
  provided: string | null,
  expected: string | undefined,
): boolean {
  // Un secret absent ferme la porte au lieu de l'ouvrir.
  if (!expected) return false;
  if (provided === null) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  // `timingSafeEqual` lève sur des Buffers de tailles différentes.
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
