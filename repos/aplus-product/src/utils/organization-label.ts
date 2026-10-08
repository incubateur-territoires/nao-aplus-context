interface OrganizationLabelSource {
  name: string;
  shortName: string | null;
}

/**
 * Libellé d'une organisation : « Nom (Sigle) » si un sigle distinct existe.
 */
export function formatOrganizationLabel(
  organization: OrganizationLabelSource,
): string {
  return organization.shortName && organization.shortName !== organization.name
    ? `${organization.name} (${organization.shortName})`
    : organization.name;
}
