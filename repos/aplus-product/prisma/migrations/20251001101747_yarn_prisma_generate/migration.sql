-- DropForeignKey
ALTER TABLE "public"."RequestStatusHistory" DROP CONSTRAINT "RequestStatusHistory_requestId_fkey";

-- DropIndex
DROP INDEX "public"."RequestStatusHistory_authorId_idx";

-- DropIndex
DROP INDEX "public"."RequestStatusHistory_requestId_idx";

-- AddForeignKey
ALTER TABLE "public"."RequestStatusHistory" ADD CONSTRAINT "RequestStatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
