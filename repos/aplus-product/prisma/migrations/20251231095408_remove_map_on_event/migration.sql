/*
  Warnings:

  - You are about to drop the `analytics_event` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "analytics_event";

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventName" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "pageUrl" TEXT,
    "pagePath" TEXT,
    "referrer" TEXT,
    "metadata" JSONB,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventName_idx" ON "AnalyticsEvent"("eventName");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventCategory_idx" ON "AnalyticsEvent"("eventCategory");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_pagePath_idx" ON "AnalyticsEvent"("pagePath");
