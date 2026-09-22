import crypto from "crypto";
import { NextResponse } from "next/server";

/**
 * Valide le Bearer token CRON_SECRET avec une comparaison constant-time.
 * Retourne null si valide, ou une NextResponse erreur sinon.
 */
export function validateCronAuth(
  authHeader: string | null,
): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const expectedAuth = `Bearer ${cronSecret}`;
  const headerValue = authHeader ?? "";

  if (
    headerValue.length !== expectedAuth.length ||
    !crypto.timingSafeEqual(Buffer.from(headerValue), Buffer.from(expectedAuth))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
