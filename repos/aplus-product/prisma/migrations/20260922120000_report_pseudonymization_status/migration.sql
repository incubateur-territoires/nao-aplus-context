-- CreateEnum
CREATE TYPE "ReportPseudonymizationStatus" AS ENUM ('FAKE', 'DONE');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN "pseudonymizationStatus" "ReportPseudonymizationStatus";

-- Les signalements déjà supprimés portent un faux texte généré par le cron :
-- ils ne sont pas exploitables, et le cron ne doit pas tenter de les reprendre.
UPDATE "Report" SET "pseudonymizationStatus" = 'FAKE' WHERE "status" = 'DELETED';

-- CreateIndex
CREATE INDEX "Report_status_pseudonymizationStatus_idx" ON "Report"("status", "pseudonymizationStatus");
