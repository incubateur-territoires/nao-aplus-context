"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ColumnDef, type SortingState } from "@tanstack/react-table";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import { Pagination } from "@/app/component/pagination/pagination";
import { DataTable } from "@/app/component/data-table/data-table";
import { ROUTE } from "@/app/constant/route";
import { useTRPC } from "@/trpc/client";
import { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { AppRouter } from "@/trpc/routers/_app";
import { useAnalytics } from "@/app/hooks/use-analytics";
import { useUrlTableState } from "@/app/hooks/use-url-table-state";
import { highlightText } from "@/app/component/reports-table/reports-table-utils/highlight-text";
import { TeamsFilters } from "../teams-filters/teams-filters";

type Team =
  inferRouterOutputs<AppRouter>["team"]["getMyTeams"]["items"][number];

type TeamsSortBy =
  | "name"
  | "territoire"
  | "organisation"
  | "registrationNumber";

const ITEMS_PER_PAGE = 10;
const MAX_VISIBLE_AREAS = 4;
const VALID_SORT_KEYS: TeamsSortBy[] = [
  "name",
  "territoire",
  "organisation",
  "registrationNumber",
];
const DEFAULT_SORT = { id: "name", desc: false };

function AreasCell({ areas }: { areas: Team["areas"] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (areas.length === 0) {
    return <span className="text-gray-500">-</span>;
  }

  if (areas.length <= MAX_VISIBLE_AREAS) {
    return (
      <div className="flex flex-wrap gap-1 whitespace-nowrap">
        {areas.map((area, index) => (
          <span key={area.id}>
            {area.name} ({area.inseeCode}){index < areas.length - 1 && ", "}
          </span>
        ))}
      </div>
    );
  }

  const visibleAreas = isExpanded ? areas : areas.slice(0, MAX_VISIBLE_AREAS);
  const remaining = areas.length - MAX_VISIBLE_AREAS;

  return (
    <div className="flex flex-wrap items-baseline gap-1 whitespace-nowrap">
      {visibleAreas.map((area, index) => (
        <span key={area.id}>
          {area.name} ({area.inseeCode})
          {index < visibleAreas.length - 1 && ", "}
        </span>
      ))}
      <button
        className="text-sm text-blue-primary underline cursor-pointer ml-1"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {isExpanded ? "Voir moins" : `+${remaining} autres`}
      </button>
    </div>
  );
}

function getTeamsTableColumns(searchQuery: string): ColumnDef<Team>[] {
  return [
    {
      id: "name",
      header: "Nom",
      accessorKey: "name",
      meta: { sortType: "alpha" },
      cell: ({ row }) => (
        <div className="font-bold">
          {highlightText(row.original.name, searchQuery)}
        </div>
      ),
      enableSorting: true,
    },
    {
      id: "territoire",
      header: "Territoire",
      accessorFn: (row) =>
        row.areas.map((a) => `${a.name} (${a.inseeCode})`).join(", "),
      meta: { sortType: "alpha" },
      cell: ({ row }) => <AreasCell areas={row.original.areas} />,
      enableSorting: true,
    },
    {
      id: "organisation",
      header: "Organisation",
      accessorFn: (row) => row.organization.shortName || row.organization.name,
      meta: { sortType: "alpha" },
      cell: ({ row }) => (
        <span>
          {row.original.organization.shortName ||
            row.original.organization.name}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: "registrationNumber",
      header: "Matricule",
      accessorKey: "registrationNumber",
      meta: { sortType: "numeric" },
      cell: ({ row }) => (
        <span>
          {row.original.registrationNumber
            ? highlightText(row.original.registrationNumber, searchQuery)
            : "n/a"}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            iconId="ri-edit-line"
            priority="secondary"
            size="small"
            linkProps={{
              href: `${ROUTE.TEAMS}/${row.original.id}`,
            }}
            title="Modifier l'équipe"
          />
        </div>
      ),
      enableSorting: false,
    },
  ];
}

export function TeamsTable() {
  const trpc = useTRPC();
  // Filtres mémorisés dans l'URL : ils survivent à la navigation (consulter une
  // équipe puis revenir) et restent partageables.
  const {
    searchInput: searchQuery,
    setSearchInput,
    debouncedSearch,
    page: currentPage,
    setPage,
    sorting,
    setSorting,
    getArrayParam,
    setArrayParam,
  } = useUrlTableState({
    prefix: "t_",
    defaultSort: DEFAULT_SORT,
    validSortKeys: VALID_SORT_KEYS,
  });
  const filterAreaIds = getArrayParam("areas");
  const filterOrgIds = getArrayParam("orgs");
  const { track } = useAnalytics();
  const hasTrackedSearch = useRef(false);

  const trimmedSearch = debouncedSearch.trim();

  const currentSort = sorting[0];
  const { data: teamsData, isLoading } = useQuery({
    ...trpc.team.getMyTeams.queryOptions({
      page: currentPage,
      pageSize: ITEMS_PER_PAGE,
      search: trimmedSearch || undefined,
      sortBy: currentSort?.id as TeamsSortBy | undefined,
      sortOrder: currentSort
        ? ((currentSort.desc ? "desc" : "asc") as "asc" | "desc")
        : undefined,
      areaIds: filterAreaIds.length > 0 ? filterAreaIds : undefined,
      organizationIds: filterOrgIds.length > 0 ? filterOrgIds : undefined,
    }),
    placeholderData: keepPreviousData,
  });

  function handleAreaIdsChange(ids: string[]) {
    setArrayParam("areas", ids);
  }

  function handleOrgIdsChange(ids: string[]) {
    setArrayParam("orgs", ids);
  }

  // Reset to page 1 when search changes
  function handleSearchChange(value: string) {
    setSearchInput(value);
    hasTrackedSearch.current = false;
  }

  const handleSortingChange = useCallback(
    (newSorting: SortingState) => {
      setSorting(newSorting);
    },
    [setSorting],
  );

  // Track search after results are loaded
  useEffect(() => {
    if (debouncedSearch && teamsData && !hasTrackedSearch.current) {
      track("teams_searched", {
        query: debouncedSearch,
        resultsCount: teamsData.items.length,
      });
      hasTrackedSearch.current = true;
    }
  }, [debouncedSearch, teamsData, track]);

  const columns = useMemo(
    () => getTeamsTableColumns(debouncedSearch),
    [debouncedSearch],
  );

  const teams = teamsData?.items ?? [];
  const totalPages = teamsData?.totalPages ?? 0;

  return (
    <div>
      <h2 className="mb-6">Toutes les équipes</h2>

      <div className="mb-6">
        <Input
          addon={
            <span className="bg-blue-primary p-2 rounded-t-l-md text-white fr-icon-search-line -mt-px"></span>
          }
          className="w-full mt-2 max-w-md"
          id="search-teams"
          label="Rechercher"
          nativeLabelProps={{ className: "fr-h6 block mb-2" }}
          nativeInputProps={{
            placeholder: "Rechercher un nom, un matricule...",
            type: "text",
            value: searchQuery,
            onChange: (e) => handleSearchChange(e.target.value),
          }}
        />
      </div>

      <div className="mb-6">
        <TeamsFilters
          areaIds={filterAreaIds}
          organizationIds={filterOrgIds}
          onAreaIdsChange={handleAreaIdsChange}
          onOrganizationIdsChange={handleOrgIdsChange}
        />
      </div>

      {isLoading ? (
        <div role="status">Chargement...</div>
      ) : (
        <div>
          <DataTable
            columns={columns}
            data={teams}
            manualSorting
            sorting={sorting}
            onSortingChange={handleSortingChange}
            emptyMessage="Aucune équipe ne correspond à vos critères de recherche."
          />
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={totalPages}
            defaultPage={currentPage}
            getPageLinkProps={(pageNumber) => ({
              href: "#",
              "aria-label": `Page ${pageNumber}`,
              onClick: (e) => {
                e.preventDefault();
                setPage(pageNumber);
              },
            })}
            showFirstLast
          />
        </div>
      )}
    </div>
  );
}
