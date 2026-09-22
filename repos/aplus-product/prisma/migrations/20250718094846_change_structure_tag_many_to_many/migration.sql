/*
  Warnings:

  - You are about to drop the column `structureId` on the `StructureTag` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StructureTag" DROP CONSTRAINT "StructureTag_structureId_fkey";

-- AlterTable
ALTER TABLE "StructureTag" DROP COLUMN "structureId";

-- CreateTable
CREATE TABLE "_StructureToStructureTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StructureToStructureTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_StructureToStructureTag_B_index" ON "_StructureToStructureTag"("B");

-- AddForeignKey
ALTER TABLE "_StructureToStructureTag" ADD CONSTRAINT "_StructureToStructureTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Structure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StructureToStructureTag" ADD CONSTRAINT "_StructureToStructureTag_B_fkey" FOREIGN KEY ("B") REFERENCES "StructureTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
