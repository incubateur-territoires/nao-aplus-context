-- Champs de verrouillage anti-brute-force 2FA requis par better-auth >= 1.6.23
-- (NIST SP 800-63B) : compteur d'échecs consécutifs et fin de blocage.
ALTER TABLE "TwoFactor" ADD COLUMN "failedVerificationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TwoFactor" ADD COLUMN "lockedUntil" TIMESTAMP(3);
