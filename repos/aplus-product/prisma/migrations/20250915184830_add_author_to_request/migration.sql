/*
  Warnings:

  - You are about to drop the `_RequestToUser` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `authorId` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'DELETED');

-- DropForeignKey
ALTER TABLE "public"."_RequestToUser" DROP CONSTRAINT "_RequestToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_RequestToUser" DROP CONSTRAINT "_RequestToUser_B_fkey";

-- AlterTable
ALTER TABLE "public"."Request" ADD COLUMN     "authorId" TEXT NOT NULL,
ADD COLUMN     "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING';

-- DropTable
DROP TABLE "public"."_RequestToUser";

-- CreateTable
CREATE TABLE "public"."_RequestColleagues" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RequestColleagues_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RequestColleagues_B_index" ON "public"."_RequestColleagues"("B");

-- AddForeignKey
ALTER TABLE "public"."Request" ADD CONSTRAINT "Request_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_RequestColleagues" ADD CONSTRAINT "_RequestColleagues_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_RequestColleagues" ADD CONSTRAINT "_RequestColleagues_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
