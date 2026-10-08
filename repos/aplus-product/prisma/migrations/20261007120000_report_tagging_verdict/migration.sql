-- Avis des destinataires sur les tags posés automatiquement, et refus d'afficher le bloc qui les recueille.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "taggingFeedbackHiddenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReportTaggingVerdict" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taggingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "procedureIsCorrect" BOOLEAN,
    "blockageIsCorrect" BOOLEAN,

    CONSTRAINT "ReportTaggingVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportTaggingVerdict_userId_idx" ON "ReportTaggingVerdict"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTaggingVerdict_taggingId_userId_key" ON "ReportTaggingVerdict"("taggingId", "userId");

-- AddForeignKey
ALTER TABLE "ReportTaggingVerdict" ADD CONSTRAINT "ReportTaggingVerdict_taggingId_fkey" FOREIGN KEY ("taggingId") REFERENCES "ReportTagging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTaggingVerdict" ADD CONSTRAINT "ReportTaggingVerdict_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
