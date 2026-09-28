-- Les deux tags fermés d'un item pour une version de taxonomie.
-- Le raisonnement vit dans prisma/schema.prisma, au-dessus du modèle.
CREATE TABLE "GoldenDatasetGold" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" TEXT NOT NULL,
    "taxonomyVersion" INTEGER NOT NULL,
    "blockageTag" TEXT NOT NULL,
    "procedureTag" TEXT NOT NULL,

    CONSTRAINT "GoldenDatasetGold_pkey" PRIMARY KEY ("id")
);

-- L'unicité (itemId, taxonomyVersion) est le contrat d'idempotence du gel,
-- calqué sur (runId, itemId) des prédictions.
CREATE UNIQUE INDEX "GoldenDatasetGold_itemId_taxonomyVersion_key" ON "GoldenDatasetGold"("itemId", "taxonomyVersion");

CREATE INDEX "GoldenDatasetGold_taxonomyVersion_idx" ON "GoldenDatasetGold"("taxonomyVersion");

ALTER TABLE "GoldenDatasetGold" ADD CONSTRAINT "GoldenDatasetGold_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GoldenDatasetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
