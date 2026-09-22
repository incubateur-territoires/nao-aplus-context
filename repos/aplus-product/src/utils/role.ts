import { OrganizationRole } from "@/generated/prisma/enums";
import { USER_ROLES, UserRole } from "@/constants/user-roles";
import prisma from "@/lib/prisma";

export function getUserRoleLabel(role: UserRole): string {
  switch (role) {
    case USER_ROLES.ADMIN:
      return "Administrateur";
    case USER_ROLES.SUPERVISOR:
      return "Superviseur";
    case USER_ROLES.USER:
      return "Utilisateur";
    default:
      return "Utilisateur";
  }
}

export function getOrganizationRoleLabel(role: OrganizationRole): string {
  switch (role) {
    case OrganizationRole.HELPER:
      return "Aidant";
    case OrganizationRole.OPERATOR:
      return "Opérateur";
    default:
      return "Aidant";
  }
}

export async function userIsManager(
  userId: string | undefined | null,
): Promise<boolean> {
  if (!userId) {
    return false;
  }
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      managedTeams: {
        where: { deletedAt: null },
      },
    },
  });
  return (user?.managedTeams?.length ?? 0) > 0;
}
