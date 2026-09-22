-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ANSWER', 'STATUS_CHANGE', 'REPORT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastDigestSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotificationView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationView_userId_idx" ON "NotificationView"("userId");

-- CreateIndex
CREATE INDEX "NotificationView_type_targetId_idx" ON "NotificationView"("type", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationView_userId_type_targetId_key" ON "NotificationView"("userId", "type", "targetId");

-- AddForeignKey
ALTER TABLE "NotificationView" ADD CONSTRAINT "NotificationView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate data from AnswerView to NotificationView
INSERT INTO "NotificationView" ("id", "userId", "type", "targetId", "viewedAt")
SELECT
    gen_random_uuid()::text,
    "userId",
    'ANSWER'::"NotificationType",
    "answerId",
    "viewedAt"
FROM "AnswerView"
ON CONFLICT ("userId", "type", "targetId") DO NOTHING;
