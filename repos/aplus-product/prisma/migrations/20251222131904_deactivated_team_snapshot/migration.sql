-- CreateTable
CREATE TABLE "DeactivatedUserTeamSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeactivatedUserTeamSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DeactivatedUserTeams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DeactivatedUserTeams_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DeactivatedUserManagedTeams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DeactivatedUserManagedTeams_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeactivatedUserTeamSnapshot_userId_key" ON "DeactivatedUserTeamSnapshot"("userId");

-- CreateIndex
CREATE INDEX "_DeactivatedUserTeams_B_index" ON "_DeactivatedUserTeams"("B");

-- CreateIndex
CREATE INDEX "_DeactivatedUserManagedTeams_B_index" ON "_DeactivatedUserManagedTeams"("B");

-- AddForeignKey
ALTER TABLE "DeactivatedUserTeamSnapshot" ADD CONSTRAINT "DeactivatedUserTeamSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeactivatedUserTeams" ADD CONSTRAINT "_DeactivatedUserTeams_A_fkey" FOREIGN KEY ("A") REFERENCES "DeactivatedUserTeamSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeactivatedUserTeams" ADD CONSTRAINT "_DeactivatedUserTeams_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeactivatedUserManagedTeams" ADD CONSTRAINT "_DeactivatedUserManagedTeams_A_fkey" FOREIGN KEY ("A") REFERENCES "DeactivatedUserTeamSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeactivatedUserManagedTeams" ADD CONSTRAINT "_DeactivatedUserManagedTeams_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
