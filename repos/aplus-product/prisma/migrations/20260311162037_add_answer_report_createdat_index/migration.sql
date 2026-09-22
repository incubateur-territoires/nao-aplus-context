-- CreateIndex
CREATE INDEX "Answer_reportId_createdAt_idx" ON "Answer"("reportId", "createdAt" DESC);
