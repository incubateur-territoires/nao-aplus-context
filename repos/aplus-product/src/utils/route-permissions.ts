import { OrganizationRole } from "@/generated/prisma/enums";
import { USER_ROLES, UserRole } from "@/constants/user-roles";

// Define route permissions based on user roles and team context
export const ROUTE_PERMISSIONS = {
  // Routes that require admin role
  ADMIN_ONLY: ["/admin", "/settings", "/user-management"],
} as const;

export type RoutePermission = keyof typeof ROUTE_PERMISSIONS;

interface TeamWithRole {
  role: OrganizationRole;
}

interface UserContext {
  role: UserRole;
  teams?: TeamWithRole[];
}

/**
 * Check if a user can access a specific route based on their role and team context
 */
export function canAccessRoute(
  user: UserContext | null | undefined,
  pathname: string,
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: "Utilisateur non connecté" };
  }

  // Check ADMIN_ONLY routes
  if (
    ROUTE_PERMISSIONS.ADMIN_ONLY.some((route) => pathname.startsWith(route))
  ) {
    if (user.role !== USER_ROLES.ADMIN) {
      return {
        allowed: false,
        reason: "Seuls les administrateurs peuvent accéder à cette page",
      };
    }
  }

  return { allowed: true };
}

/**
 * Check if user has any team with OPERATOR role
 */
export function hasOperatorAccess(
  user: UserContext | null | undefined,
): boolean {
  if (!user?.teams) return false;
  return user.teams.some((team) => team.role === OrganizationRole.OPERATOR);
}

/**
 * Check if user has any team with HELPER role
 */
export function hasHelperAccess(user: UserContext | null | undefined): boolean {
  if (!user?.teams) return false;
  return user.teams.some((team) => team.role === OrganizationRole.HELPER);
}

/**
 * Get all routes that a user can access based on their role
 */
export function getAccessibleRoutes(
  user: UserContext | null | undefined,
): string[] {
  const accessibleRoutes: string[] = [];

  if (!user) return accessibleRoutes;

  // Add ADMIN_ONLY routes if user is an admin
  if (user.role === USER_ROLES.ADMIN) {
    accessibleRoutes.push(...ROUTE_PERMISSIONS.ADMIN_ONLY);
  }

  return accessibleRoutes;
}
