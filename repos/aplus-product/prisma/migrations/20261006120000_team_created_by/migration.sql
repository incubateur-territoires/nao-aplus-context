-- AlterTable
ALTER TABLE "Team" ADD COLUMN "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise : le créateur des équipes existantes n'est connu que par l'événement
-- analytics team_created ; les équipes plus anciennes restent sans créateur.
-- Sous impersonation, l'événement porte l'admin et non l'utilisateur impersonné :
-- les événements d'un admin sont ambigus et ne sont pas repris.
UPDATE "Team" t
SET "createdById" = e."userId"
FROM (
  SELECT DISTINCT ON (metadata->>'teamId') metadata->>'teamId' AS "teamId", "userId"
  FROM "AnalyticsEvent"
  WHERE "eventName" = 'team_created' AND "userId" IS NOT NULL
  ORDER BY metadata->>'teamId', "createdAt"
) e
WHERE t."id" = e."teamId"
  AND EXISTS (SELECT 1 FROM "User" u WHERE u."id" = e."userId" AND u."role" <> 'admin');
