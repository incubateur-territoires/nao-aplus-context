import { TeamType } from "@/generated/prisma/enums";
import { TEAM_TYPE_OPTIONS } from "@/constants/team-types";

export const HELPER_TYPE_OPTIONS = TEAM_TYPE_OPTIONS.filter(
  (option) => option.value !== TeamType.OPERATOR,
);

interface OrganizationLike {
  type: TeamType;
}

/**
 * Détermine le type d'équipe à auto-sélectionner lors d'un changement d'organisation.
 * Le type de la team hérite directement du type de l'organisation.
 */
export function getTeamTypeOnOrganizationChange(
  organization: OrganizationLike | undefined,
): TeamType | null {
  if (!organization) return null;
  return organization.type;
}
