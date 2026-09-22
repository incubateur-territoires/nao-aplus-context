/*
  Warnings:

  - A unique constraint covering the columns `[id_v1]` on the table `Structure` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_v1` to the `Structure` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Structure" ADD COLUMN     "id_v1" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Structure_id_v1_key" ON "Structure"("id_v1");
