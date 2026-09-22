-- Drop existing unique indexes
DROP INDEX IF EXISTS "Team_registrationNumber_key";
DROP INDEX IF EXISTS "Team_organizationId_name_registrationNumber_key";

-- Create partial unique indexes that only apply to non-deleted teams
CREATE UNIQUE INDEX "Team_registrationNumber_key"
  ON "Team" ("registrationNumber")
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "Team_organizationId_name_registrationNumber_key"
  ON "Team" ("organizationId", "name", "registrationNumber")
  WHERE "deletedAt" IS NULL;
