import prisma from "@/lib/prisma";

async function main() {
  console.log("Finding and removing duplicate teams...");

  // Get all teams
  const teams = await prisma.team.findMany({
    include: {
      organization: true,
      areas: true,
      users: true,
      reports: true,
      applicantReports: true,
    },
  });

  // Group teams by organizationId + name
  const teamGroups = new Map<string, typeof teams>();

  for (const team of teams) {
    const key = `${team.organizationId}|${team.name}`;
    if (!teamGroups.has(key)) {
      teamGroups.set(key, []);
    }
    teamGroups.get(key)!.push(team);
  }

  // Find duplicates
  const duplicateGroups = Array.from(teamGroups.entries()).filter(
    ([, teams]) => teams.length > 1,
  );

  console.log(`Found ${duplicateGroups.length} duplicate team groups`);

  for (const [key, duplicateTeams] of duplicateGroups) {
    console.log(`\nProcessing duplicates for: ${key}`);
    console.log(`  Found ${duplicateTeams.length} duplicates`);

    // Keep the oldest team (first created)
    const sortedTeams = duplicateTeams.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const teamToKeep = sortedTeams[0];
    const teamsToDelete = sortedTeams.slice(1);

    console.log(
      `  Keeping team: ${teamToKeep.id} (created: ${teamToKeep.createdAt})`,
    );

    // For each team to delete, migrate its relationships to the kept team
    for (const teamToDelete of teamsToDelete) {
      console.log(
        `  Deleting team: ${teamToDelete.id} (created: ${teamToDelete.createdAt})`,
      );

      // Migrate users
      if (teamToDelete.users.length > 0) {
        console.log(`    Moving ${teamToDelete.users.length} users`);
        await prisma.team.update({
          where: { id: teamToKeep.id },
          data: {
            users: {
              connect: teamToDelete.users.map((u) => ({ id: u.id })),
            },
          },
        });
      }

      // Migrate reports (requestedTeams)
      if (teamToDelete.reports.length > 0) {
        console.log(
          `    Moving ${teamToDelete.reports.length} requested reports`,
        );
        await prisma.team.update({
          where: { id: teamToKeep.id },
          data: {
            reports: {
              connect: teamToDelete.reports.map((r) => ({ id: r.id })),
            },
          },
        });
      }

      // Migrate applicant reports
      if (teamToDelete.applicantReports.length > 0) {
        console.log(
          `    Moving ${teamToDelete.applicantReports.length} applicant reports`,
        );
        for (const report of teamToDelete.applicantReports) {
          await prisma.report.update({
            where: { id: report.id },
            data: { applicantTeamId: teamToKeep.id },
          });
        }
      }

      // Ensure the kept team has all areas from the duplicate
      for (const area of teamToDelete.areas) {
        const hasArea = teamToKeep.areas.some((a) => a.id === area.id);
        if (!hasArea) {
          console.log(`    Adding area ${area.name} to kept team`);
          await prisma.team.update({
            where: { id: teamToKeep.id },
            data: {
              areas: {
                connect: { id: area.id },
              },
            },
          });
        }
      }

      // Delete the duplicate team
      await prisma.team.delete({
        where: { id: teamToDelete.id },
      });
    }
  }

  console.log("\nDuplicate removal complete!");
  console.log(`Processed ${duplicateGroups.length} duplicate groups`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
