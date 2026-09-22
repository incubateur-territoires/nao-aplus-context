/*
  Warnings:

  - A unique constraint covering the columns `[shortName]` on the table `Structure` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Structure_shortName_key" ON "Structure"("shortName");
