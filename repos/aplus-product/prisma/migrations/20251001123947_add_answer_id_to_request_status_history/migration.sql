-- AlterTable
ALTER TABLE "public"."RequestStatusHistory" ADD COLUMN     "answerId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."RequestStatusHistory" ADD CONSTRAINT "RequestStatusHistory_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "public"."Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
