-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inactivityWarningsSentAt" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
ADD COLUMN     "lastActivityAt" TIMESTAMP(3);
