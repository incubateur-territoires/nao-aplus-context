-- Index de performance pour les stats du bandeau signalements et le filtre équipes.
-- CreateIndex
CREATE INDEX "Report_applicantTeamId_idx" ON "Report"("applicantTeamId");

-- CreateIndex
CREATE INDEX "ReportStatusHistory_status_reportId_idx" ON "ReportStatusHistory"("status", "reportId");
