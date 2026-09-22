import prisma from "@/lib/prisma";

/**
 * Creates DeactivatedUserTeamSnapshot for inactive users and disconnects them from teams.
 * Must run AFTER connectUsersTeams (so team connections exist) and BEFORE cleanupInactiveTeams.
 */
export async function snapshotInactiveUsers() {
  console.log("\n📸 Snapshotting inactive users...");

  // Find all inactive users who have team connections but no snapshot yet
  const inactiveUsers = await prisma.user.findMany({
    where: {
      isInactive: { not: null },
      deletedAt: null,
      deactivatedTeamSnapshot: null,
      OR: [{ teams: { some: {} } }, { managedTeams: { some: {} } }],
    },
    select: {
      id: true,
      teams: { select: { id: true } },
      managedTeams: { select: { id: true } },
    },
  });

  console.log(
    `  📋 Found ${inactiveUsers.length} inactive users with teams but no snapshot`,
  );

  if (inactiveUsers.length === 0) {
    console.log("✅ No inactive users to snapshot.");
    return;
  }

  let processed = 0;
  const CHUNK_SIZE = 100;

  for (let i = 0; i < inactiveUsers.length; i += CHUNK_SIZE) {
    const chunk = inactiveUsers.slice(i, i + CHUNK_SIZE);

    for (const user of chunk) {
      const teamIds = user.teams.map((t) => t.id);
      const managedTeamIds = user.managedTeams.map((t) => t.id);

      await prisma.$transaction([
        // Create snapshot
        prisma.deactivatedUserTeamSnapshot.create({
          data: {
            userId: user.id,
            teams: { connect: teamIds.map((id) => ({ id })) },
            managedTeams: { connect: managedTeamIds.map((id) => ({ id })) },
          },
        }),
        // Disconnect from teams
        prisma.user.update({
          where: { id: user.id },
          data: {
            teams: { set: [] },
            managedTeams: { set: [] },
          },
        }),
      ]);
    }

    processed += chunk.length;
    if (processed % 500 < CHUNK_SIZE || processed === inactiveUsers.length) {
      console.log(`  ... ${processed}/${inactiveUsers.length} users`);
    }
  }

  console.log(`\n✅ Inactive users snapshotted: ${processed} processed`);

  return { processed };
}

// Run standalone
if (require.main === module) {
  snapshotInactiveUsers()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error snapshotting inactive users:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
