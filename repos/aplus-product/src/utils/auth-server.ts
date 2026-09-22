import "server-only";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { USER_ROLES, UserRole } from "@/constants/user-roles";
import prisma from "@/lib/prisma";

export async function getCurrentUserId(): Promise<string | null> {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return session?.user?.id ?? null;
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return (session?.user?.role as UserRole) ?? null;
}

export async function isCurrentUserManager(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const count = await prisma.team.count({
    where: {
      managers: {
        some: { id: userId },
      },
      deletedAt: null,
    },
  });

  return count > 0;
}

export async function isAdminOrManager(): Promise<boolean> {
  const role = await getCurrentUserRole();
  if (role === USER_ROLES.ADMIN || role === USER_ROLES.SUPERVISOR) return true;

  return isCurrentUserManager();
}

/**
 * Révoque immédiatement toutes les sessions actives d'un utilisateur.
 *
 * Indispensable car les sessions vivent dans le secondaryStorage Redis
 * (`storeSessionInDatabase` non activé) : un simple `prisma.session.deleteMany`
 * vide la table Postgres mais PAS Redis, donc l'utilisateur reste connecté.
 * `internalAdapter.deleteUserSessions` supprime bien les tokens côté Redis.
 *
 * On passe par l'internalAdapter (et non l'endpoint admin `revokeUserSessions`)
 * pour ne pas re-vérifier les permissions : l'appelant a déjà été autorisé en
 * amont (admin, superviseur ou manager dans le périmètre).
 */
export async function revokeUserSessions(userId: string): Promise<void> {
  const authContext = await auth.$context;
  await authContext.internalAdapter.deleteUserSessions(userId);
}
