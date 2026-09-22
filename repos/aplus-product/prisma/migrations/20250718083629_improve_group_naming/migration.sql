/*
  Warnings:

  - You are about to drop the column `organizations` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the `_RequestToStructure` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `applicantGroupId` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_RequestToStructure" DROP CONSTRAINT "_RequestToStructure_A_fkey";

-- DropForeignKey
ALTER TABLE "_RequestToStructure" DROP CONSTRAINT "_RequestToStructure_B_fkey";

-- AlterTable
ALTER TABLE "Request" DROP COLUMN "organizations",
ADD COLUMN     "applicantGroupId" TEXT NOT NULL,
ADD COLUMN     "structureId" TEXT;

-- DropTable
DROP TABLE "_RequestToStructure";

-- CreateTable
CREATE TABLE "_RequestedGroups" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RequestedGroups_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RequestedGroups_B_index" ON "_RequestedGroups"("B");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_applicantGroupId_fkey" FOREIGN KEY ("applicantGroupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RequestedGroups" ADD CONSTRAINT "_RequestedGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RequestedGroups" ADD CONSTRAINT "_RequestedGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
