import { OrganizationRole } from "@/generated/prisma/enums";
import { USER_ROLES, UserRole } from "@/constants/user-roles";

// User role checks (single value, not array)
export function isAdmin(userRole?: UserRole): boolean {
  return userRole === USER_ROLES.ADMIN;
}

export function isUser(userRole?: UserRole): boolean {
  return userRole === USER_ROLES.USER;
}

export function isSupervisor(userRole?: UserRole): boolean {
  return userRole === USER_ROLES.SUPERVISOR;
}

// Team/Organization role checks (contextual)
interface TeamWithRole {
  role: OrganizationRole;
}

interface OrganizationWithRole {
  role: OrganizationRole;
}

export function isTeamOperator(team?: TeamWithRole | null): boolean {
  return team?.role === OrganizationRole.OPERATOR;
}

export function isTeamHelper(team?: TeamWithRole | null): boolean {
  return team?.role === OrganizationRole.HELPER;
}

export function isOrganizationOperator(
  organization?: OrganizationWithRole | null,
): boolean {
  return organization?.role === OrganizationRole.OPERATOR;
}

export function isOrganizationHelper(
  organization?: OrganizationWithRole | null,
): boolean {
  return organization?.role === OrganizationRole.HELPER;
}

// Check if user has any team with OPERATOR role
interface UserWithTeams {
  teams: TeamWithRole[];
}

export function hasOperatorTeam(user?: UserWithTeams | null): boolean {
  if (!user?.teams) return false;
  return user.teams.some((team) => team.role === OrganizationRole.OPERATOR);
}

export function hasHelperTeam(user?: UserWithTeams | null): boolean {
  if (!user?.teams) return false;
  return user.teams.some((team) => team.role === OrganizationRole.HELPER);
}

// Get team role for a specific team ID
interface UserWithTeamsAndId {
  teams: (TeamWithRole & { id: string })[];
}

export function getUserTeamRole(
  user: UserWithTeamsAndId | null | undefined,
  teamId: string,
): OrganizationRole | null {
  if (!user?.teams) return null;
  const team = user.teams.find((t) => t.id === teamId);
  return team?.role ?? null;
}
