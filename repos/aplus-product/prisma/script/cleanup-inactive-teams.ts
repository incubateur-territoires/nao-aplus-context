import prisma from "@/lib/prisma";

/**
 * Soft-delete teams that have no members or no active members.
 * A member is "active" when their `isInactive` field is NULL.
 * Must run AFTER users, teams, and user-team connections are imported.
 */
export async function cleanupInactiveTeams() {
  console.log("\n🧹 Cleaning up teams without active members...");

  const now = new Date();

  // 1. Soft-delete teams with zero members
  const noMembers = await prisma.$executeRaw`
    UPDATE "Team"
    SET "deletedAt" = ${now}
    WHERE "deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "_TeamToUser" tu WHERE tu."A" = "Team".id
      )
  `;
  console.log(`  ${noMembers} team(s) soft-deleted (no members at all)`);

  // 2. Soft-delete teams with members but none active
  const noActiveMembers = await prisma.$executeRaw`
    UPDATE "Team"
    SET "deletedAt" = ${now}
    WHERE "deletedAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM "_TeamToUser" tu WHERE tu."A" = "Team".id
      )
      AND NOT EXISTS (
        SELECT 1 FROM "_TeamToUser" tu
        JOIN "User" u ON u.id = tu."B"
        WHERE tu."A" = "Team".id AND u."isInactive" IS NULL
      )
  `;
  console.log(
    `  ${noActiveMembers} team(s) soft-deleted (only inactive members)`,
  );

  const total = noMembers + noActiveMembers;
  console.log(`\n✅ ${total} team(s) soft-deleted total`);

  return {
    noMembers: Number(noMembers),
    noActiveMembers: Number(noActiveMembers),
    total: Number(total),
  };
}

// Run standalone
if (require.main === module) {
  cleanupInactiveTeams()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error cleaning up inactive teams:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
