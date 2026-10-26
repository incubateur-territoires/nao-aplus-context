-- Motif des refus de caviardage : leur cause et le type des données restées en clair, jamais leur valeur.
-- CreateEnum
CREATE TYPE "ReportPseudonymizationRefusalKind" AS ENUM ('GUARD', 'PROVIDER');

-- AlterTable
ALTER TABLE "ReportPseudonymizationRefusal" ADD COLUMN     "kind" "ReportPseudonymizationRefusalKind",
ADD COLUMN     "providerStatus" INTEGER,
ADD COLUMN     "violationCounts" JSONB;
