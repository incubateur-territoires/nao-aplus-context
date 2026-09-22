/*
  Warnings:

  - You are about to drop the column `address` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `birthName` on the `Request` table. All the data in the column will be lost.
  - Made the column `birthDate` on table `Request` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Request" DROP COLUMN "address",
DROP COLUMN "birthName",
ALTER COLUMN "birthDate" SET NOT NULL;
