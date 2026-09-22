/*
  Warnings:

  - You are about to drop the column `territory` on the `Request` table. All the data in the column will be lost.
  - Added the required column `areaId` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Request" DROP COLUMN "territory",
ADD COLUMN     "areaId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
