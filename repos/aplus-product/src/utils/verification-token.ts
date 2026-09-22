import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

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

interface TokenPayload {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

function getSecret() {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    throw new Error("TOKEN_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed JWT verification token
 */
export async function createVerificationToken(
  payload: TokenPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

/**
 * Verifies and decodes a verification token
 * Returns the payload if valid, null if invalid/expired
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      email: payload.email as string,
      firstName: payload.firstName as string | null | undefined,
      lastName: payload.lastName as string | null | undefined,
    };
  } catch {
    return null;
  }
}
