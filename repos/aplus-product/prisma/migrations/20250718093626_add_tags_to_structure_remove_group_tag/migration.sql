/*
  Warnings:

  - You are about to drop the `GroupTag` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GroupTag" DROP CONSTRAINT "GroupTag_groupId_fkey";

-- DropTable
DROP TABLE "GroupTag";

-- CreateTable
CREATE TABLE "StructureTag" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "structureId" TEXT,

    CONSTRAINT "StructureTag_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StructureTag" ADD CONSTRAINT "StructureTag_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
