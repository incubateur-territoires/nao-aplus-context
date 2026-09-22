-- DropIndex
DROP INDEX "File_id_key";

-- CreateIndex
CREATE INDEX "File_reportId_idx" ON "File"("reportId");
