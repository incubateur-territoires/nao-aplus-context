-- Colonne dédiée pour l'utilisateur cible d'un événement (désactivation,
-- impersonation, retrait d'équipe...), jusqu'ici enfoui dans le JSON metadata.
ALTER TABLE "AnalyticsEvent" ADD COLUMN "targetUserId" TEXT;

CREATE INDEX "AnalyticsEvent_targetUserId_idx" ON "AnalyticsEvent"("targetUserId");

-- Backfill depuis le metadata des lignes existantes.
UPDATE "AnalyticsEvent"
SET "targetUserId" = COALESCE(metadata ->> 'targetUserId', metadata ->> 'removedUserId')
WHERE metadata ->> 'targetUserId' IS NOT NULL
   OR metadata ->> 'removedUserId' IS NOT NULL;
