-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('EACH_SOLICITATION', 'TWICE_DAILY', 'ONCE_DAILY', 'NONE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationFrequency" "NotificationFrequency" NOT NULL DEFAULT 'EACH_SOLICITATION';
