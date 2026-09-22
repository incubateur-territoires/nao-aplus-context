-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "coAuthorsId" TEXT[];

-- CreateTable
CREATE TABLE "_ReportCoAuthors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ReportCoAuthors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ReportCoAuthors_B_index" ON "_ReportCoAuthors"("B");

-- AddForeignKey
ALTER TABLE "_ReportCoAuthors" ADD CONSTRAINT "_ReportCoAuthors_A_fkey" FOREIGN KEY ("A") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReportCoAuthors" ADD CONSTRAINT "_ReportCoAuthors_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
