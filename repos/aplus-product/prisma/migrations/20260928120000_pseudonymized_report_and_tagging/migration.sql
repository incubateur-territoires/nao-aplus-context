-- Texte pseudonymisé des signalements et de leurs réponses, refus du
-- caviardage, étiquettes posées par le modèle. Le raisonnement vit dans prisma/schema.prisma.
CREATE TABLE "PseudonymizedReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "PseudonymizedReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PseudonymizedAnswer" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "PseudonymizedAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportPseudonymizationRefusal" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "refusedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportPseudonymizationRefusal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportTagging" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT NOT NULL,
    "recipeKey" TEXT NOT NULL,
    "procedureLabel" TEXT,
    "procedureTag" TEXT,
    "blockageLabel" TEXT,
    "blockageTag" TEXT,

    CONSTRAINT "ReportTagging_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PseudonymizedReport_reportId_key" ON "PseudonymizedReport"("reportId");

CREATE UNIQUE INDEX "PseudonymizedAnswer_answerId_key" ON "PseudonymizedAnswer"("answerId");

CREATE UNIQUE INDEX "ReportPseudonymizationRefusal_reportId_key" ON "ReportPseudonymizationRefusal"("reportId");

-- Contrat d'idempotence de l'étiquetage : une ligne par signalement et par recette.
CREATE UNIQUE INDEX "ReportTagging_reportId_recipeKey_key" ON "ReportTagging"("reportId", "recipeKey");

ALTER TABLE "PseudonymizedReport" ADD CONSTRAINT "PseudonymizedReport_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PseudonymizedAnswer" ADD CONSTRAINT "PseudonymizedAnswer_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportPseudonymizationRefusal" ADD CONSTRAINT "ReportPseudonymizationRefusal_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportTagging" ADD CONSTRAINT "ReportTagging_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
