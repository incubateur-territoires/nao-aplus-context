/*
  Warnings:

  - The primary key for the `Area` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[id]` on the table `Area` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Area" DROP CONSTRAINT "Area_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "Area_id_key" ON "Area"("id");
