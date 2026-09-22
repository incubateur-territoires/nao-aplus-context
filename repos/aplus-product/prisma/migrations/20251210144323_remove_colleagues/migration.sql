/*
  Warnings:

  - You are about to drop the `_ReportColleagues` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ReportColleagues" DROP CONSTRAINT "_ReportColleagues_A_fkey";

-- DropForeignKey
ALTER TABLE "_ReportColleagues" DROP CONSTRAINT "_ReportColleagues_B_fkey";

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "userId" TEXT;

-- DropTable
DROP TABLE "_ReportColleagues";

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
