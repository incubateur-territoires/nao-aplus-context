import prisma from "@/lib/prisma";
import { tznrTeams } from "../data/tznr_teams";
import { acceptTznR } from "../data/accepted_type_tznr";

export async function fixTznrTypes() {
  if (tznrTeams.length === 0) {
    console.log("No TZNR teams to update.");
    return 0;
  }

  const result = await prisma.team.updateMany({
    where: { id: { in: tznrTeams } },
    data: { type: "TZNR" },
  });

  console.log(`Fixed ${result.count} teams (type → TZNR).`);

  // Set acceptTypes to TZNR only for teams in acceptTznR list
  if (acceptTznR.length > 0) {
    const tznrAcceptResult = await prisma.team.updateMany({
      where: { id: { in: acceptTznR } },
      data: { acceptTypes: ["TZNR"] },
    });
    console.log(
      `Set acceptTypes → [TZNR] for ${tznrAcceptResult.count} teams.`,
    );
  }

  // Set acceptTypes for all other teams
  const otherResult = await prisma.team.updateMany({
    where: { id: { notIn: acceptTznR } },
    data: {
      acceptTypes: ["OPERATOR", "FRANCE_SERVICE", "HISTORICAL_SOCIAL_WORKER"],
    },
  });
  console.log(
    `Set acceptTypes → [OPERATOR, FRANCE_SERVICE, HISTORICAL_SOCIAL_WORKER] for ${otherResult.count} teams.`,
  );

  return result.count;
}

if (require.main === module) {
  fixTznrTypes()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
