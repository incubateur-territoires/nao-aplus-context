/*
  Warnings:

  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OPERATOR', 'HELPER');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "role" "OrganizationRole" NOT NULL DEFAULT 'HELPER';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "role" "OrganizationRole" NOT NULL DEFAULT 'HELPER';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- DropEnum
DROP TYPE "Role";
