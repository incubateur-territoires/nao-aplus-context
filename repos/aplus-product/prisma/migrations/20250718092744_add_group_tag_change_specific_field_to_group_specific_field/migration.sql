/*
  Warnings:

  - You are about to drop the `SpecificField` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_SpecificFieldToStructure` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_SpecificFieldToStructure" DROP CONSTRAINT "_SpecificFieldToStructure_A_fkey";

-- DropForeignKey
ALTER TABLE "_SpecificFieldToStructure" DROP CONSTRAINT "_SpecificFieldToStructure_B_fkey";

-- DropTable
DROP TABLE "SpecificField";

-- DropTable
DROP TABLE "_SpecificFieldToStructure";

-- CreateTable
CREATE TABLE "GroupSpecificField" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,

    CONSTRAINT "GroupSpecificField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTag" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT,

    CONSTRAINT "GroupTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GroupSpecificFieldToStructure" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GroupSpecificFieldToStructure_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GroupSpecificFieldToStructure_B_index" ON "_GroupSpecificFieldToStructure"("B");

-- AddForeignKey
ALTER TABLE "GroupTag" ADD CONSTRAINT "GroupTag_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupSpecificFieldToStructure" ADD CONSTRAINT "_GroupSpecificFieldToStructure_A_fkey" FOREIGN KEY ("A") REFERENCES "GroupSpecificField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupSpecificFieldToStructure" ADD CONSTRAINT "_GroupSpecificFieldToStructure_B_fkey" FOREIGN KEY ("B") REFERENCES "Structure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
