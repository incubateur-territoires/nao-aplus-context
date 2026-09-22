/*
  Warnings:

  - You are about to drop the `_RequestedGroups` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_RequestedGroups" DROP CONSTRAINT "_RequestedGroups_A_fkey";

-- DropForeignKey
ALTER TABLE "_RequestedGroups" DROP CONSTRAINT "_RequestedGroups_B_fkey";

-- DropTable
DROP TABLE "_RequestedGroups";

-- CreateTable
CREATE TABLE "_RequestToRequestedGroups" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RequestToRequestedGroups_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RequestToRequestedGroups_B_index" ON "_RequestToRequestedGroups"("B");

-- AddForeignKey
ALTER TABLE "_RequestToRequestedGroups" ADD CONSTRAINT "_RequestToRequestedGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RequestToRequestedGroups" ADD CONSTRAINT "_RequestToRequestedGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
