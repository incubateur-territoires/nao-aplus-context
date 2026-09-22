-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "internalSupportComment" TEXT,
ADD COLUMN     "publicNote" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'OTHER';
