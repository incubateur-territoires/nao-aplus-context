/*
  Warnings:

  - You are about to drop the column `coAuthorsId` on the `Report` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Report" DROP COLUMN "coAuthorsId";

-- CreateTable
CREATE TABLE "PendingUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PendingUsersTeams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PendingUsersTeams_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PendingManagersTeams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PendingManagersTeams_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingUser_email_key" ON "PendingUser"("email");

-- CreateIndex
CREATE INDEX "_PendingUsersTeams_B_index" ON "_PendingUsersTeams"("B");

-- CreateIndex
CREATE INDEX "_PendingManagersTeams_B_index" ON "_PendingManagersTeams"("B");

-- AddForeignKey
ALTER TABLE "_PendingUsersTeams" ADD CONSTRAINT "_PendingUsersTeams_A_fkey" FOREIGN KEY ("A") REFERENCES "PendingUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PendingUsersTeams" ADD CONSTRAINT "_PendingUsersTeams_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PendingManagersTeams" ADD CONSTRAINT "_PendingManagersTeams_A_fkey" FOREIGN KEY ("A") REFERENCES "PendingUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PendingManagersTeams" ADD CONSTRAINT "_PendingManagersTeams_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
