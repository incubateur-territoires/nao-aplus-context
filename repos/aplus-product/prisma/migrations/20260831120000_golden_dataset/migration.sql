-- Golden dataset : corpus figé de signalements caviardés, annoté à la main par
-- plusieurs administrateurs pour servir de référence aux futures evals.
--
-- "reportId" est un TEXT nu, sans clé étrangère vers "Report" : le cron
-- d'anonymisation supprime ou anonymise les signalements au bout de six mois et
-- le corpus doit y survivre. La colonne ne sert qu'à la traçabilité.
CREATE TABLE "GoldenDatasetItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "organization" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "GoldenDatasetItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoldenDatasetItem_reportId_key" ON "GoldenDatasetItem"("reportId");

CREATE UNIQUE INDEX "GoldenDatasetItem_position_key" ON "GoldenDatasetItem"("position");

-- L'unicité (itemId, annotatorId) rend l'enregistrement idempotent : chaque
-- annotateur écrit sa propre ligne, deux administrateurs ne peuvent donc pas
-- entrer en concurrence sur la même, et l'état « deux annotations du même
-- administrateur sur le même item » est irreprésentable.
CREATE TABLE "GoldenDatasetAnnotation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT NOT NULL,
    "annotatorId" TEXT NOT NULL,
    "blockageTag" TEXT,
    "procedureTag" TEXT,

    CONSTRAINT "GoldenDatasetAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GoldenDatasetAnnotation_annotatorId_idx" ON "GoldenDatasetAnnotation"("annotatorId");

CREATE UNIQUE INDEX "GoldenDatasetAnnotation_itemId_annotatorId_key" ON "GoldenDatasetAnnotation"("itemId", "annotatorId");

ALTER TABLE "GoldenDatasetAnnotation" ADD CONSTRAINT "GoldenDatasetAnnotation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GoldenDatasetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoldenDatasetAnnotation" ADD CONSTRAINT "GoldenDatasetAnnotation_annotatorId_fkey" FOREIGN KEY ("annotatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
