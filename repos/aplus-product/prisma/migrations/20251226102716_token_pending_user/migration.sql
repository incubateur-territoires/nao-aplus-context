/*
  Warnings:

  - A unique constraint covering the columns `[verificationToken]` on the table `PendingUser` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tokenExpiresAt` to the `PendingUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verificationToken` to the `PendingUser` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PendingUser" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verificationToken" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cguAcceptedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "PendingUser_verificationToken_key" ON "PendingUser"("verificationToken");
