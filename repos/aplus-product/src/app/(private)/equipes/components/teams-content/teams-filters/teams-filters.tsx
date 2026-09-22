"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { MultiSelectAutocomplete } from "@/app/component/multi-select-autocomplete/multi-select-autocomplete";

interface TeamsFiltersProps {
  areaIds: string[];
  organizationIds: string[];
  onAreaIdsChange: (ids: string[]) => void;
  onOrganizationIdsChange: (ids: string[]) => void;
}

export function TeamsFilters({
  areaIds,
  organizationIds,
  onAreaIdsChange,
  onOrganizationIdsChange,
}: TeamsFiltersProps) {
  const trpc = useTRPC();

  const { data: areas } = useQuery(trpc.area.getMyAreas.queryOptions());
  const { data: organizations } = useQuery(
    trpc.organization.getMyOrganizations.queryOptions(),
  );
  const { data: isSupervisor } = useQuery(
    trpc.user.isSupervisor.queryOptions(),
  );

  const areaOptions = useMemo(() => areas ?? [], [areas]);
  const orgOptions = useMemo(() => organizations ?? [], [organizations]);

  // Lie chaque chip au texte d'aide « mise à jour automatique » (RGAA).
  const chipDescribedBy = { "aria-describedby": "teams-filters-hint" };

  function getOrgLabel(org: (typeof orgOptions)[number]) {
    return org.shortName && org.shortName !== org.name
      ? `${org.name} (${org.shortName})`
      : org.name;
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="fr-h6 m-0">Filtrer</h2>

      <p id="teams-filters-hint" className="sr-only">
        Les résultats se mettent à jour automatiquement à l&apos;activation
        d&apos;un filtre.
      </p>

      <div className="flex flex-col gap-6">
        <div className="w-full md:w-80">
          <MultiSelectAutocomplete
            id="filter-territoire"
            label="Filtrer par territoire"
            placeholder="Département(s)"
            options={areaOptions}
            value={areaIds}
            onChange={onAreaIdsChange}
            getOptionLabel={(option) => option.name}
            noOptionsText="Aucun département trouvé"
            chipsContainerAriaLabel="Territoires sélectionnés"
            getChipButtonProps={() => chipDescribedBy}
          />
        </div>

        {!isSupervisor && (
          <div className="w-full md:w-80">
            <MultiSelectAutocomplete
              id="filter-organisation"
              label="Filtrer par organisation"
              placeholder="Organisation(s)"
              options={orgOptions}
              value={organizationIds}
              onChange={onOrganizationIdsChange}
              getOptionLabel={getOrgLabel}
              renderOptionContent={(option) => (
                <>
                  {option.name}
                  {option.shortName && option.shortName !== option.name && (
                    <span className="ml-1 text-(--text-mention-grey)">
                      ({option.shortName})
                    </span>
                  )}
                </>
              )}
              noOptionsText="Aucune organisation trouvée"
              chipsContainerAriaLabel="Organisations sélectionnées"
              getChipButtonProps={() => chipDescribedBy}
            />
          </div>
        )}
      </div>
    </div>
  );
}
