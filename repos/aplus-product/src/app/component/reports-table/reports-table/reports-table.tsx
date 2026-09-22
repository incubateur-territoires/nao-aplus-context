"use client";

import { useMemo, useEffect, useRef, useCallback } from "react";
import { DataTable } from "../../data-table/data-table";
import { ReportsTableFilters } from "../reports-table-filters/reports-table-filters";
import { getReportsTableColumns } from "../reports-table-columns/reports-table-columns";
import { FullUser } from "@/types/user";
import { ReportMode } from "@/types/report-mode";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/app/hooks/use-debounce";
import { useAnalytics } from "@/app/hooks/use-analytics";
import { Pagination } from "@/app/component/pagination/pagination";
import {
  usePaginatedReports,
  ReportTableItem,
} from "../use-paginated-reports/use-paginated-reports";

// Re-export pour la compatibilité avec les autres fichiers
export type myReportTableType = ReportTableItem;

interface ReportsTableProps {
  currentUser: FullUser | null | undefined;
  mode: ReportMode;
}

export function ReportsTable({ currentUser, mode }: ReportsTableProps) {
  const trpc = useTRPC();
  const { track } = useAnalytics();
  const hasTrackedSearch = useRef(false);

  const {
    reports,
    isLoading,
    page,
    setPage,
    totalCount,
    totalPages,
    statusFilters,
    setStatusFilters,
    teamsFilters,
    setTeamsFilters,
    searchQuery,
    setSearchQuery,
    selectedMyReports,
    handleMyReportsToggle,
    selectedMyAnsweredReports,
    handleMyAnsweredReportsToggle,
    selectedOverdueOnly,
    handleOverdueToggle,
    sorting,
    setSorting,
  } = usePaginatedReports({
    mode,
    currentUserId: currentUser?.id,
  });

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Track search after debounce
  useEffect(() => {
    if (debouncedSearch && !hasTrackedSearch.current) {
      track("reports_searched", {
        query: debouncedSearch,
        resultsCount: totalCount,
        filters: {
          statusFilters: statusFilters.length > 0 ? statusFilters : undefined,
          teamsFilters: teamsFilters.length > 0 ? teamsFilters : undefined,
          myReportsOnly: selectedMyReports || undefined,
          myAnsweredOnly: selectedMyAnsweredReports || undefined,
        },
      });
      hasTrackedSearch.current = true;
    }
  }, [
    debouncedSearch,
    totalCount,
    track,
    statusFilters,
    teamsFilters,
    selectedMyReports,
    selectedMyAnsweredReports,
  ]);

  // Reset tracking flag when search changes
  useEffect(() => {
    hasTrackedSearch.current = false;
  }, [searchQuery]);

  // Fetch unread counts for current page reports
  const reportIds = useMemo(() => reports.map((r) => r.id), [reports]);
  const { data: unreadData } = useQuery({
    ...trpc.answer.getUnreadCountsByReports.queryOptions({ reportIds }),
    enabled: reportIds.length > 0,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });

  const unviewedReportIds = useMemo(
    () => new Set(unreadData?.unviewedReportIds ?? []),
    [unreadData?.unviewedReportIds],
  );

  const columns = useMemo(
    () =>
      getReportsTableColumns(
        searchQuery,
        unreadData?.counts,
        unviewedReportIds,
      ),
    [searchQuery, unreadData?.counts, unviewedReportIds],
  );

  const getPageLinkProps = useCallback(
    (pageNumber: number) => ({
      href: "#",
      "aria-label": `Page ${pageNumber}`,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        setPage(pageNumber);
      },
    }),
    [setPage],
  );

  // Affichage du loader pendant le chargement initial
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12" role="status">
        <div className="animate-pulse text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div>
      <ReportsTableFilters
        mode={mode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentUser={currentUser}
        totalCount={totalCount}
        handleMyReportsToggle={handleMyReportsToggle}
        selectedMyReports={selectedMyReports}
        selectedMyAnsweredReports={selectedMyAnsweredReports}
        handleMyAnsweredReportsToggle={handleMyAnsweredReportsToggle}
        selectedOverdueOnly={selectedOverdueOnly}
        handleOverdueToggle={handleOverdueToggle}
        selectedStatuses={statusFilters}
        onStatusFilterChange={setStatusFilters}
        selectedTeams={teamsFilters}
        onTeamFilterChange={setTeamsFilters}
      />
      <DataTable
        columns={columns}
        data={reports}
        manualSorting
        sorting={sorting}
        onSortingChange={setSorting}
        emptyMessage="Aucun signalement ne correspond à vos critères de recherche."
      />
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={totalPages}
            defaultPage={page}
            getPageLinkProps={getPageLinkProps}
            showFirstLast
          />
        </div>
      )}
    </div>
  );
}
