-- Le label de référence retenu par l'équipe sur chaque item, un par axe.
-- Le raisonnement vit dans prisma/schema.prisma, au-dessus du modèle.
ALTER TABLE "GoldenDatasetItem"
    ADD COLUMN "goldenBlockageTag" TEXT,
    ADD COLUMN "goldenProcedureTag" TEXT;
