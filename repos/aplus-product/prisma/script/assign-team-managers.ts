import prisma from "@/lib/prisma";
import { findMostActiveTeamMember } from "@/utils/report";

/**
 * Assigns a manager to teams that have active members but no manager.
 * Uses findMostActiveTeamMember to pick the most active member.
 * Must run AFTER snapshotInactiveUsers and BEFORE cleanupInactiveTeams.
 */
export async function assignTeamManagers() {
  console.log("\n👔 Assigning managers to orphaned teams...");

  // Find all non-deleted teams with active members but no manager
  const orphanedTeams = await prisma.team.findMany({
    where: {
      deletedAt: null,
      managers: { none: {} },
      users: {
        some: {
          isInactive: null,
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      name: true,
      users: {
        where: {
          isInactive: null,
          deletedAt: null,
        },
        select: { id: true },
      },
    },
  });

  console.log(`  📋 Found ${orphanedTeams.length} teams without a manager`);

  if (orphanedTeams.length === 0) {
    console.log("✅ No orphaned teams to process.");
    return { teamsProcessed: 0, managersAssigned: 0 };
  }

  let managersAssigned = 0;

  for (const team of orphanedTeams) {
    const memberIds = team.users.map((m) => m.id);

    try {
      const newManagerId = await findMostActiveTeamMember(memberIds, prisma);

      await prisma.team.update({
        where: { id: team.id },
        data: {
          managers: { connect: { id: newManagerId } },
        },
      });

      managersAssigned++;
      console.log(`  ✅ ${team.name}: manager assigned`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ ${team.name}: ${message}`);
    }
  }

  console.log(
    `\n✅ Team managers assigned: ${managersAssigned}/${orphanedTeams.length}`,
  );

  return { teamsProcessed: orphanedTeams.length, managersAssigned };
}

// Run standalone
if (require.main === module) {
  assignTeamManagers()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error assigning team managers:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
