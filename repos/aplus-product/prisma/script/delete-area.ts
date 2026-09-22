import prisma from "@/lib/prisma";

const AREA_ID = "771f5924-7065-31c7-b464-341fc48afb05";

export async function deleteArea() {
  console.log(`\n🗑  Suppression de l'area ${AREA_ID}...`);

  // Déconnecter les équipes liées à cette area
  const teams = await prisma.team.findMany({
    where: { areas: { some: { id: AREA_ID } } },
    select: { id: true, name: true },
  });

  for (const team of teams) {
    await prisma.team.update({
      where: { id: team.id },
      data: { areas: { disconnect: { id: AREA_ID } } },
    });
    console.log(`  → Équipe "${team.name}" déconnectée`);
  }

  // Déconnecter les supervisors et pendingSupervisors
  const [supervisors, pendingSupervisors] = await Promise.all([
    prisma.supervisor.findMany({
      where: { areas: { some: { id: AREA_ID } } },
      select: { id: true },
    }),
    prisma.pendingSupervisor.findMany({
      where: { areas: { some: { id: AREA_ID } } },
      select: { id: true },
    }),
  ]);

  for (const s of supervisors) {
    await prisma.supervisor.update({
      where: { id: s.id },
      data: { areas: { disconnect: { id: AREA_ID } } },
    });
  }

  for (const ps of pendingSupervisors) {
    await prisma.pendingSupervisor.update({
      where: { id: ps.id },
      data: { areas: { disconnect: { id: AREA_ID } } },
    });
  }

  // Supprimer l'area
  const deleted = await prisma.area.deleteMany({
    where: { id: AREA_ID },
  });

  console.log(
    `  → ${teams.length} équipe(s) déconnectée(s), ${supervisors.length} superviseur(s) déconnecté(s), ${deleted.count} area supprimée`,
  );

  return {
    teamsDisconnected: teams.length,
    supervisorsDisconnected: supervisors.length,
    pendingSupervisorsDisconnected: pendingSupervisors.length,
    deleted: deleted.count,
  };
}
