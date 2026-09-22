-- CreateTable
CREATE TABLE "_TeamManager" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TeamManager_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TeamManager_B_index" ON "_TeamManager"("B");

-- AddForeignKey
ALTER TABLE "_TeamManager" ADD CONSTRAINT "_TeamManager_A_fkey" FOREIGN KEY ("A") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeamManager" ADD CONSTRAINT "_TeamManager_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
