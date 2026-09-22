-- Migration: OVERDUE devient un tag (overdueAt) au lieu d'un état du status

-- 1. Ajouter la colonne overdueAt
ALTER TABLE "Report" ADD COLUMN "overdueAt" TIMESTAMP(3);

-- 2. Backfill : pour chaque report actuellement OVERDUE,
--    restaurer son précédent statut non-OVERDUE (depuis ReportStatusHistory)
--    et poser overdueAt à la date du passage en OVERDUE.
WITH overdue_reports AS (
    SELECT id FROM "Report" WHERE "status"::text = 'OVERDUE'
),
last_overdue_history AS (
    SELECT DISTINCT ON ("reportId")
        "reportId",
        "createdAt" AS overdue_at
    FROM "ReportStatusHistory"
    WHERE "status"::text = 'OVERDUE'
      AND "reportId" IN (SELECT id FROM overdue_reports)
    ORDER BY "reportId", "createdAt" DESC
),
previous_status AS (
    SELECT DISTINCT ON (rsh."reportId")
        rsh."reportId",
        rsh."status"::text AS prev_status
    FROM "ReportStatusHistory" rsh
    JOIN last_overdue_history loh ON loh."reportId" = rsh."reportId"
    WHERE rsh."createdAt" < loh.overdue_at
      AND rsh."status"::text <> 'OVERDUE'
    ORDER BY rsh."reportId", rsh."createdAt" DESC
)
UPDATE "Report" r
SET
    "overdueAt" = COALESCE(loh.overdue_at, r."updatedAt"),
    "status" = COALESCE(ps.prev_status, 'IN_TREATMENT')::"ReportStatus"
FROM overdue_reports ovr
LEFT JOIN last_overdue_history loh ON loh."reportId" = ovr.id
LEFT JOIN previous_status ps ON ps."reportId" = ovr.id
WHERE r.id = ovr.id;

-- 3. Supprimer les entrées OVERDUE de l'historique (plus de signification désormais)
DELETE FROM "ReportStatusHistory" WHERE "status"::text = 'OVERDUE';

-- 4. Recréer l'enum sans OVERDUE
ALTER TYPE "ReportStatus" RENAME TO "ReportStatus_old";
CREATE TYPE "ReportStatus" AS ENUM ('PENDING_ASSIGNMENT', 'IN_TREATMENT', 'COMPLETED', 'CLOSED', 'DELETED');
ALTER TABLE "Report" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Report" ALTER COLUMN "status" TYPE "ReportStatus" USING ("status"::text::"ReportStatus");
ALTER TABLE "Report" ALTER COLUMN "status" SET DEFAULT 'PENDING_ASSIGNMENT';
ALTER TABLE "ReportStatusHistory" ALTER COLUMN "status" TYPE "ReportStatus" USING ("status"::text::"ReportStatus");
DROP TYPE "ReportStatus_old";

-- 5. Index sur overdueAt pour les filtres
CREATE INDEX "Report_overdueAt_idx" ON "Report"("overdueAt");
