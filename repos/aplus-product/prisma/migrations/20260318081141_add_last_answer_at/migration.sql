-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "lastAnswerAt" TIMESTAMP(3);

-- Backfill: set lastAnswerAt to the latest answer's createdAt for each report
UPDATE "Report" r
SET "lastAnswerAt" = sub."maxCreatedAt"
FROM (
  SELECT "reportId", MAX("createdAt") AS "maxCreatedAt"
  FROM "Answer"
  GROUP BY "reportId"
) sub
WHERE r."id" = sub."reportId";

-- CreateIndex
CREATE INDEX "Report_lastAnswerAt_idx" ON "Report"("lastAnswerAt" DESC);
