import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { ReportStatus } from "@/generated/prisma/enums";
import { ReportMode } from "@/types/report-mode";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/app/hooks/use-debounce";
import type { SortingState } from "@tanstack/react-table";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

// Type pour un rapport dans le tableau
type RouterOutputs = inferRouterOutputs<AppRouter>;
export type ReportTableItem =
  RouterOutputs["report"]["getMyCreatedReportsTable"]["reports"][number];

interface UsePaginatedReportsProps {
  mode: ReportMode;
  currentUserId: string | undefined;
}

interface UsePaginatedReportsReturn {
  // Données
  reports: ReportTableItem[];
  isLoading: boolean;
  // Pagination
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  // Filtres
  statusFilters: ReportStatus[];
  setStatusFilters: (filters: ReportStatus[]) => void;
  teamsFilters: string[];
  setTeamsFilters: (filters: string[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedMyReports: boolean;
  handleMyReportsToggle: () => void;
  selectedMyAnsweredReports: boolean;
  handleMyAnsweredReportsToggle: () => void;
  selectedOverdueOnly: boolean;
  handleOverdueToggle: () => void;
  // Tri
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  // Actions
  resetFilters: () => void;
}

const PAGE_SIZE = 10;

const VALID_STATUSES = new Set<string>(Object.values(ReportStatus));

type SortBy = "citizen-subject" | "status" | "createdAt" | "lastMessage";
const VALID_SORT_BY = new Set<string>([
  "citizen-subject",
  "status",
  "createdAt",
  "lastMessage",
]);
const DEFAULT_SORT: { id: SortBy; desc: boolean } = {
  id: "lastMessage",
  desc: true,
};

/**
 * Gère la pagination, le tri et les filtres de la liste de signalements.
 *
 * L'état est entièrement porté par les query params de l'URL (et non par du
 * state local) afin qu'il survive à la navigation : consulter un signalement
 * puis revenir (ou via le bouton « page précédente ») restaure les filtres.
 *
 * Deux tableaux coexistent sur la page (CREATED et REQUESTED) : les params sont
 * donc préfixés par mode (`c_` / `r_`) pour éviter les collisions.
 */
export function usePaginatedReports({
  mode,
}: UsePaginatedReportsProps): UsePaginatedReportsReturn {
  const trpc = useTRPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const prefix = mode === ReportMode.CREATED ? "c_" : "r_";

  // Met à jour les query params de ce tableau en préservant ceux de l'autre.
  const updateParams = useCallback(
    (
      updates: Record<string, string | null>,
      opts?: { resetPage?: boolean },
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [name, value] of Object.entries(updates)) {
        const fullKey = `${prefix}${name}`;
        if (value === null || value === "") params.delete(fullKey);
        else params.set(fullKey, value);
      }
      if (opts?.resetPage) params.delete(`${prefix}page`);
      const qs = params.toString();
      // Native History API : met à jour l'URL et `useSearchParams` (donc React
      // Query refetch la table) SANS aller-retour serveur RSC. `router.replace`
      // re-exécuterait tout le prefetch du Server Component (dont le SQL stats
      // lourd) à chaque filtre.
      const url = qs ? `${pathname}?${qs}` : pathname;
      window.history.replaceState(null, "", url);
    },
    [searchParams, prefix, pathname],
  );

  // --- Valeurs dérivées de l'URL (source de vérité) ---

  const statusFilters = useMemo<ReportStatus[]>(() => {
    const raw = searchParams.get(`${prefix}status`);
    if (!raw) return [];
    return raw
      .split(",")
      .filter((s): s is ReportStatus => VALID_STATUSES.has(s));
  }, [searchParams, prefix]);

  const teamsFilters = useMemo<string[]>(() => {
    const raw = searchParams.get(`${prefix}teams`);
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams, prefix]);

  const selectedMyReports = searchParams.get(`${prefix}mine`) === "1";
  const selectedMyAnsweredReports =
    searchParams.get(`${prefix}answered`) === "1";
  const selectedOverdueOnly = searchParams.get(`${prefix}overdue`) === "1";

  const page = useMemo(() => {
    const raw = Number(searchParams.get(`${prefix}page`));
    return Number.isInteger(raw) && raw > 0 ? raw : 1;
  }, [searchParams, prefix]);

  const sorting = useMemo<SortingState>(() => {
    const sortBy = searchParams.get(`${prefix}sort`);
    if (sortBy && VALID_SORT_BY.has(sortBy)) {
      return [
        { id: sortBy, desc: searchParams.get(`${prefix}order`) !== "asc" },
      ];
    }
    return [{ id: DEFAULT_SORT.id, desc: DEFAULT_SORT.desc }];
  }, [searchParams, prefix]);

  // --- Recherche : input local + écriture debouncée dans l'URL ---

  const urlSearch = searchParams.get(`${prefix}q`) ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Écrit la recherche debouncée dans l'URL.
  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      updateParams({ q: debouncedSearch || null }, { resetPage: true });
    }
    // urlSearch/updateParams volontairement omis : déclenché par la frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Resynchronise l'input quand l'URL change de l'extérieur (retour navigateur).
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // --- Setters (écrivent dans l'URL, réinitialisent la page) ---

  const setPage = useCallback(
    (newPage: number) => {
      updateParams({ page: newPage > 1 ? String(newPage) : null });
    },
    [updateParams],
  );

  const setStatusFilters = useCallback(
    (filters: ReportStatus[]) => {
      updateParams(
        { status: filters.length ? filters.join(",") : null },
        { resetPage: true },
      );
    },
    [updateParams],
  );

  const setTeamsFilters = useCallback(
    (filters: string[]) => {
      updateParams(
        { teams: filters.length ? filters.join(",") : null },
        { resetPage: true },
      );
    },
    [updateParams],
  );

  const handleMyReportsToggle = useCallback(() => {
    updateParams({ mine: selectedMyReports ? null : "1" }, { resetPage: true });
  }, [updateParams, selectedMyReports]);

  const handleMyAnsweredReportsToggle = useCallback(() => {
    updateParams(
      { answered: selectedMyAnsweredReports ? null : "1" },
      { resetPage: true },
    );
  }, [updateParams, selectedMyAnsweredReports]);

  const handleOverdueToggle = useCallback(() => {
    updateParams(
      { overdue: selectedOverdueOnly ? null : "1" },
      { resetPage: true },
    );
  }, [updateParams, selectedOverdueOnly]);

  const setSorting = useCallback(
    (newSorting: SortingState) => {
      const next = newSorting[0];
      const isDefault =
        !next ||
        (next.id === DEFAULT_SORT.id && next.desc === DEFAULT_SORT.desc);
      updateParams(
        {
          sort: isDefault ? null : next.id,
          order: isDefault ? null : next.desc ? "desc" : "asc",
        },
        { resetPage: true },
      );
    },
    [updateParams],
  );

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of Array.from(params.keys())) {
      if (k.startsWith(prefix)) params.delete(k);
    }
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState(null, "", url);
    setSearchInput("");
  }, [searchParams, prefix, pathname]);

  // --- Construction des paramètres de requête ---

  const currentSort = sorting[0];
  const queryInput = {
    page,
    pageSize: PAGE_SIZE,
    status: statusFilters.length > 0 ? statusFilters : undefined,
    teamIds: teamsFilters.length > 0 ? teamsFilters : undefined,
    search: urlSearch || undefined,
    myReportsOnly: selectedMyReports || undefined,
    myAnsweredOnly: selectedMyAnsweredReports || undefined,
    overdueOnly: selectedOverdueOnly || undefined,
    sortBy: currentSort?.id as SortBy | undefined,
    sortOrder: currentSort
      ? ((currentSort.desc ? "desc" : "asc") as "asc" | "desc")
      : undefined,
  };

  // Requête tRPC avec pagination serveur
  const queryOptions =
    mode === ReportMode.CREATED
      ? trpc.report.getMyCreatedReportsTable.queryOptions(queryInput)
      : trpc.report.getMyRequestedReportsTable.queryOptions(queryInput);

  const { data, isLoading } = useQuery({
    ...queryOptions,
    refetchOnWindowFocus: true,
    staleTime: 30_000, // Cache 30 secondes
    placeholderData: (previousData) => previousData, // Garde les données précédentes pendant le chargement
  });

  return {
    // Données
    reports: (data?.reports ?? []) as ReportTableItem[],
    isLoading,
    // Pagination
    page,
    setPage,
    pageSize: PAGE_SIZE,
    totalCount: data?.pagination.totalCount ?? 0,
    totalPages: data?.pagination.totalPages ?? 0,
    // Filtres
    statusFilters,
    setStatusFilters,
    teamsFilters,
    setTeamsFilters,
    searchQuery: searchInput,
    setSearchQuery: setSearchInput,
    selectedMyReports,
    handleMyReportsToggle,
    selectedMyAnsweredReports,
    handleMyAnsweredReportsToggle,
    selectedOverdueOnly,
    handleOverdueToggle,
    // Tri
    sorting,
    setSorting,
    // Actions
    resetFilters,
  };
}
