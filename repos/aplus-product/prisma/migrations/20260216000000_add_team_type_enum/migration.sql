-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('OPERATOR', 'FRANCE_SERVICE', 'HISTORICAL_SOCIAL_WORKER', 'TZNR', 'OTHERS_HELPERS');

-- Convert existing data: map old string values to new enum
-- First, add a temporary column with the enum type
ALTER TABLE "Team" ADD COLUMN "type_new" "TeamType" NOT NULL DEFAULT 'OTHERS_HELPERS';

-- Copy existing values where possible
UPDATE "Team" SET "type_new" = 'FRANCE_SERVICE' WHERE "type" = 'FRANCE_SERVICE';
UPDATE "Team" SET "type_new" = 'HISTORICAL_SOCIAL_WORKER' WHERE "type" = 'HISTORICAL_SOCIAL_WORKER';
UPDATE "Team" SET "type_new" = 'TZNR' WHERE "type" = 'TZNR';
UPDATE "Team" SET "type_new" = 'OTHERS_HELPERS' WHERE "type" IN ('OTHER', 'OTHERS_HELPERS');

-- Drop old column and rename new one
ALTER TABLE "Team" DROP COLUMN "type";
ALTER TABLE "Team" RENAME COLUMN "type_new" TO "type";

-- Set OPERATOR type for all teams belonging to OPERATOR organizations
UPDATE "Team" SET "type" = 'OPERATOR' WHERE "role" = 'OPERATOR';

-- Add acceptTypes column with all team types as default
ALTER TABLE "Team" ADD COLUMN "acceptTypes" "TeamType"[] NOT NULL DEFAULT ARRAY['OPERATOR', 'FRANCE_SERVICE', 'HISTORICAL_SOCIAL_WORKER', 'TZNR', 'OTHERS_HELPERS']::"TeamType"[];
