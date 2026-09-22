-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "impersonatedBy" TEXT;

-- CreateIndex
CREATE INDEX "Answer_reportId_idx" ON "Answer"("reportId");

-- CreateIndex
CREATE INDEX "Answer_authorId_idx" ON "Answer"("authorId");

-- CreateIndex
CREATE INDEX "Answer_reportId_isMetadataOnly_idx" ON "Answer"("reportId", "isMetadataOnly");

-- CreateIndex
CREATE INDEX "Report_authorId_idx" ON "Report"("authorId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "ReportStatusHistory_reportId_idx" ON "ReportStatusHistory"("reportId");

-- CreateIndex
CREATE INDEX "ReportStatusHistory_authorId_idx" ON "ReportStatusHistory"("authorId");

-- CreateIndex
CREATE INDEX "User_notificationFrequency_isInactive_idx" ON "User"("notificationFrequency", "isInactive");
