-- CreateTable
CREATE TABLE "public"."RequestStatusHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "status" "public"."RequestStatus" NOT NULL,
    "authorId" TEXT,
    CONSTRAINT "RequestStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestStatusHistory_requestId_idx" ON "public"."RequestStatusHistory"("requestId");

-- CreateIndex
CREATE INDEX "RequestStatusHistory_authorId_idx" ON "public"."RequestStatusHistory"("authorId");

-- AddForeignKey
ALTER TABLE "public"."RequestStatusHistory" ADD CONSTRAINT "RequestStatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RequestStatusHistory" ADD CONSTRAINT "RequestStatusHistory_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

