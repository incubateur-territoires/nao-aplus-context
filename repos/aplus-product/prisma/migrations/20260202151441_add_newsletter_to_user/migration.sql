/*
  Warnings:

  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "image",
ADD COLUMN     "internalSupportComment" TEXT,
ADD COLUMN     "newsLetterAcceptedAt" TIMESTAMP(3);
