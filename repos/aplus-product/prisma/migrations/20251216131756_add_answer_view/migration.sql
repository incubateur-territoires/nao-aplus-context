-- CreateTable
CREATE TABLE "AnswerView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnswerView_userId_idx" ON "AnswerView"("userId");

-- CreateIndex
CREATE INDEX "AnswerView_answerId_idx" ON "AnswerView"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerView_userId_answerId_key" ON "AnswerView"("userId", "answerId");

-- AddForeignKey
ALTER TABLE "AnswerView" ADD CONSTRAINT "AnswerView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerView" ADD CONSTRAINT "AnswerView_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
