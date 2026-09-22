/*
  Warnings:

  - The values [WAITING_FOR_ANSWER] on the enum `ReportStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ReportStatus_new" AS ENUM ('PENDING_ASSIGNMENT', 'IN_TREATMENT', 'COMPLETED', 'CLOSED', 'DELETED');
ALTER TABLE "public"."Report" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Report" ALTER COLUMN "status" TYPE "public"."ReportStatus_new" USING ("status"::text::"public"."ReportStatus_new");
ALTER TABLE "public"."ReportStatusHistory" ALTER COLUMN "status" TYPE "public"."ReportStatus_new" USING ("status"::text::"public"."ReportStatus_new");
ALTER TYPE "public"."ReportStatus" RENAME TO "ReportStatus_old";
ALTER TYPE "public"."ReportStatus_new" RENAME TO "ReportStatus";
DROP TYPE "public"."ReportStatus_old";
ALTER TABLE "public"."Report" ALTER COLUMN "status" SET DEFAULT 'PENDING_ASSIGNMENT';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Report" ALTER COLUMN "status" SET DEFAULT 'PENDING_ASSIGNMENT';
