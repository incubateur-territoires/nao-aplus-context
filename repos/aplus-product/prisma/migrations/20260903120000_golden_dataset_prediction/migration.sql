-- Prédictions de modèles Albert sur le golden dataset, à comparer aux
-- annotations humaines. Le raisonnement derrière ces deux tables vit dans
-- prisma/schema.prisma, au-dessus des modèles correspondants.

-- Un run est une recette, pas une exécution : l'unicité ci-dessous fait que
-- relancer la même recette complète la série au lieu d'en créer une jumelle.
-- "systemPrompt" et "userTemplate" sont stockés en entier parce qu'un
-- "promptHash" sans sa préimage ne sert à rien dans six mois.
CREATE TABLE "GoldenDatasetRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userTemplate" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GoldenDatasetRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoldenDatasetRun_model_promptHash_temperature_key" ON "GoldenDatasetRun"("model", "promptHash", "temperature");

-- Pas de colonne "error" : un appel définitivement échoué n'écrit aucune ligne,
-- et c'est l'absence de ligne qui fait repasser l'item au tour suivant.
-- L'unicité (runId, itemId) est le contrat d'idempotence, calqué sur
-- (itemId, annotatorId) de la table humaine.
CREATE TABLE "GoldenDatasetPrediction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "blockageTag" TEXT,
    "procedureTag" TEXT,
    "rawOutput" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,

    CONSTRAINT "GoldenDatasetPrediction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GoldenDatasetPrediction_itemId_idx" ON "GoldenDatasetPrediction"("itemId");

CREATE UNIQUE INDEX "GoldenDatasetPrediction_runId_itemId_key" ON "GoldenDatasetPrediction"("runId", "itemId");

ALTER TABLE "GoldenDatasetPrediction" ADD CONSTRAINT "GoldenDatasetPrediction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GoldenDatasetRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoldenDatasetPrediction" ADD CONSTRAINT "GoldenDatasetPrediction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GoldenDatasetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
