/*
  Warnings:

  - A unique constraint covering the columns `[registrationNumber]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,name,registrationNumber]` on the table `Team` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Team_organizationId_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Team_registrationNumber_key" ON "Team"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_name_registrationNumber_key" ON "Team"("organizationId", "name", "registrationNumber");
