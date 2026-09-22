-- CreateTable
CREATE TABLE "analytics_event" (
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

    CONSTRAINT "analytics_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_event_eventName_idx" ON "analytics_event"("eventName");

-- CreateIndex
CREATE INDEX "analytics_event_eventCategory_idx" ON "analytics_event"("eventCategory");

-- CreateIndex
CREATE INDEX "analytics_event_userId_idx" ON "analytics_event"("userId");

-- CreateIndex
CREATE INDEX "analytics_event_createdAt_idx" ON "analytics_event"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_event_pagePath_idx" ON "analytics_event"("pagePath");
