import prisma from "@/lib/prisma";

/**
 * Met à jour le champ notificationsViewedBefore de tous les utilisateurs actifs
 * à la date actuelle, afin que tout le contenu existant soit considéré comme
 * déjà consulté (pas de pastilles rouges ni de digest gonflé après un init-db).
 */
export async function markAllAsViewed() {
  const updated = await prisma.user.updateMany({
    where: {
      isInactive: null,
      deletedAt: null,
    },
    data: {
      notificationsViewedBefore: new Date(),
    },
  });
  console.log(
    `   → ${updated.count} utilisateurs marqués (notificationsViewedBefore = NOW())`,
  );

  return { count: updated.count };
}
