-- CreateTable
CREATE TABLE "public"."_AnswerToFile" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AnswerToFile_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AnswerToFile_B_index" ON "public"."_AnswerToFile"("B");

-- AddForeignKey
ALTER TABLE "public"."_AnswerToFile" ADD CONSTRAINT "_AnswerToFile_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_AnswerToFile" ADD CONSTRAINT "_AnswerToFile_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
