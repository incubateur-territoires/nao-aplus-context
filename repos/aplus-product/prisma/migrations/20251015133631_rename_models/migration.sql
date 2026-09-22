/*
  Warnings:

  - You are about to drop the column `requestId` on the `Answer` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `File` table. All the data in the column will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupSpecificField` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Request` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RequestStatusHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Structure` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StructureTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_AreaToGroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_GroupSpecificFieldToStructure` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_GroupToUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_RequestColleagues` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_RequestToRequestedGroups` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_StructureToStructureTag` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `reportId` to the `Answer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reportId` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('WAITING_FOR_ANSWER', 'IN_TREATMENT', 'COMPLETED', 'CLOSED', 'DELETED');

-- DropForeignKey
ALTER TABLE "public"."Answer" DROP CONSTRAINT "Answer_requestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."File" DROP CONSTRAINT "File_requestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Group" DROP CONSTRAINT "Group_structureId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Request" DROP CONSTRAINT "Request_applicantGroupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Request" DROP CONSTRAINT "Request_areaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Request" DROP CONSTRAINT "Request_authorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Request" DROP CONSTRAINT "Request_structureId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RequestStatusHistory" DROP CONSTRAINT "RequestStatusHistory_answerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RequestStatusHistory" DROP CONSTRAINT "RequestStatusHistory_authorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RequestStatusHistory" DROP CONSTRAINT "RequestStatusHistory_requestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_AreaToGroup" DROP CONSTRAINT "_AreaToGroup_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_AreaToGroup" DROP CONSTRAINT "_AreaToGroup_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."_GroupSpecificFieldToStructure" DROP CONSTRAINT "_GroupSpecificFieldToStructure_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_GroupSpecificFieldToStructure" DROP CONSTRAINT "_GroupSpecificFieldToStructure_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."_GroupToUser" DROP CONSTRAINT "_GroupToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_GroupToUser" DROP CONSTRAINT "_GroupToUser_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."_RequestColleagues" DROP CONSTRAINT "_RequestColleagues_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_RequestColleagues" DROP CONSTRAINT "_RequestColleagues_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."_RequestToRequestedGroups" DROP CONSTRAINT "_RequestToRequestedGroups_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_RequestToRequestedGroups" DROP CONSTRAINT "_RequestToRequestedGroups_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."_StructureToStructureTag" DROP CONSTRAINT "_StructureToStructureTag_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_StructureToStructureTag" DROP CONSTRAINT "_StructureToStructureTag_B_fkey";

-- AlterTable
ALTER TABLE "public"."Answer" DROP COLUMN "requestId",
ADD COLUMN     "reportId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."File" DROP COLUMN "requestId",
ADD COLUMN     "reportId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."Group";

-- DropTable
DROP TABLE "public"."GroupSpecificField";

-- DropTable
DROP TABLE "public"."Request";

-- DropTable
DROP TABLE "public"."RequestStatusHistory";

-- DropTable
DROP TABLE "public"."Structure";

-- DropTable
DROP TABLE "public"."StructureTag";

-- DropTable
DROP TABLE "public"."_AreaToGroup";

-- DropTable
DROP TABLE "public"."_GroupSpecificFieldToStructure";

-- DropTable
DROP TABLE "public"."_GroupToUser";

-- DropTable
DROP TABLE "public"."_RequestColleagues";

-- DropTable
DROP TABLE "public"."_RequestToRequestedGroups";

-- DropTable
DROP TABLE "public"."_StructureToStructureTag";

-- DropEnum
DROP TYPE "public"."RequestStatus";

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "areaId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "caf" TEXT,
    "nir" TEXT,
    "nif" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "phone" TEXT,
    "citizenPermissionConfirmed" BOOLEAN NOT NULL,
    "applicantTeamId" TEXT NOT NULL,
    "organizationId" TEXT,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'WAITING_FOR_ANSWER',
    "authorId" TEXT NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "id_v1" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "additionalInformation" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeamSpecificField" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "hintText" TEXT,
    "name" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,

    CONSTRAINT "TeamSpecificField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrganizationTag" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "OrganizationTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReportStatusHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT NOT NULL,
    "status" "public"."ReportStatus" NOT NULL,
    "authorId" TEXT,
    "answerId" TEXT,

    CONSTRAINT "ReportStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ReportColleagues" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ReportColleagues_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_ReportToRequestedTeams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ReportToRequestedTeams_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_OrganizationToTeamSpecificField" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OrganizationToTeamSpecificField_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_OrganizationToOrganizationTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OrganizationToOrganizationTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_AreaToTeam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AreaToTeam_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_TeamToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TeamToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_id_v1_key" ON "public"."Organization"("id_v1");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_shortName_key" ON "public"."Organization"("shortName");

-- CreateIndex
CREATE INDEX "_ReportColleagues_B_index" ON "public"."_ReportColleagues"("B");

-- CreateIndex
CREATE INDEX "_ReportToRequestedTeams_B_index" ON "public"."_ReportToRequestedTeams"("B");

-- CreateIndex
CREATE INDEX "_OrganizationToTeamSpecificField_B_index" ON "public"."_OrganizationToTeamSpecificField"("B");

-- CreateIndex
CREATE INDEX "_OrganizationToOrganizationTag_B_index" ON "public"."_OrganizationToOrganizationTag"("B");

-- CreateIndex
CREATE INDEX "_AreaToTeam_B_index" ON "public"."_AreaToTeam"("B");

-- CreateIndex
CREATE INDEX "_TeamToUser_B_index" ON "public"."_TeamToUser"("B");

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "public"."Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_applicantTeamId_fkey" FOREIGN KEY ("applicantTeamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportStatusHistory" ADD CONSTRAINT "ReportStatusHistory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportStatusHistory" ADD CONSTRAINT "ReportStatusHistory_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportStatusHistory" ADD CONSTRAINT "ReportStatusHistory_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "public"."Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ReportColleagues" ADD CONSTRAINT "_ReportColleagues_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ReportColleagues" ADD CONSTRAINT "_ReportColleagues_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ReportToRequestedTeams" ADD CONSTRAINT "_ReportToRequestedTeams_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ReportToRequestedTeams" ADD CONSTRAINT "_ReportToRequestedTeams_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OrganizationToTeamSpecificField" ADD CONSTRAINT "_OrganizationToTeamSpecificField_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OrganizationToTeamSpecificField" ADD CONSTRAINT "_OrganizationToTeamSpecificField_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."TeamSpecificField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OrganizationToOrganizationTag" ADD CONSTRAINT "_OrganizationToOrganizationTag_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OrganizationToOrganizationTag" ADD CONSTRAINT "_OrganizationToOrganizationTag_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."OrganizationTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_AreaToTeam" ADD CONSTRAINT "_AreaToTeam_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_AreaToTeam" ADD CONSTRAINT "_AreaToTeam_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TeamToUser" ADD CONSTRAINT "_TeamToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TeamToUser" ADD CONSTRAINT "_TeamToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
