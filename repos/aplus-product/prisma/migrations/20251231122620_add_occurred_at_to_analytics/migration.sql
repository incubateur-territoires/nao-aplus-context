-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "occurredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");
