/*
  Warnings:

  - The values [INSTRUCTOR] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `isInstructorOnly` on the `Answer` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'USER', 'OPERATOR', 'HELPER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new"[] USING ("role"::text::"Role_new"[]);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT ARRAY['USER']::"Role"[];
COMMIT;

-- AlterTable
ALTER TABLE "Answer" DROP COLUMN "isInstructorOnly",
ADD COLUMN     "isOperatorOnly" BOOLEAN NOT NULL DEFAULT false;
