import crypto from "node:crypto";

/**
 * Hash a password-reset token before storing it in the Verification table.
 * The user receives the raw token by email; only the SHA-256 digest is
 * persisted, so a DB read (replica leak, backup exposure, SQLi elsewhere)
 * does not yield working takeover tokens.
 *
 * SHA-256 (no salt, no peppering) is appropriate here because the token is
 * already a 128-bit random UUID — it has uniform high entropy, so no
 * stretching is needed and no offline brute-force is feasible.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Jeton du lien d'invitation, retrouvé tel quel en base à l'inscription.
 * Purement aléatoire (256 bits) : rien ne permet de le recalculer, ni les
 * informations de la personne invitée, ni un secret d'environnement.
 */
export function createInvitationToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
