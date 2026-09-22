import prisma from "@/lib/prisma";
import { isFranceServiceOrganization } from "@/utils/organization";

export async function fixFranceServiceTypes() {
  const teams = await prisma.team.findMany({
    where: {
      type: { not: "FRANCE_SERVICE" },
      organization: {
        name: { contains: "France Services" },
      },
    },
    include: { organization: true },
  });

  const teamsToFix = teams.filter((t) =>
    isFranceServiceOrganization(t.organization.name),
  );

  if (teamsToFix.length === 0) {
    console.log("No France Services teams to fix.");
    return 0;
  }

  const result = await prisma.team.updateMany({
    where: { id: { in: teamsToFix.map((t) => t.id) } },
    data: { type: "FRANCE_SERVICE" },
  });

  console.log(
    `Fixed ${result.count} France Services teams (type → FRANCE_SERVICE).`,
  );
  return result.count;
}

if (require.main === module) {
  fixFranceServiceTypes()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
