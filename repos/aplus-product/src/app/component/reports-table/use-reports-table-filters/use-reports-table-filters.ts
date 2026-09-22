import { useMemo, useState } from "react";
import { ReportStatus } from "@/generated/prisma/enums";
import { myReportTableType } from "../reports-table/reports-table";
import { ReportMode } from "@/types/report-mode";
import { normalizeSearchQuery } from "@/utils/normalize";

interface UseReportsTableFiltersReturn {
  selectedMyReports: boolean;
  handleMyReportsToggle: () => void;
  selectedMyAnsweredReports: boolean;
  handleMyAnsweredReportsToggle: () => void;
  statusFilters: ReportStatus[];
  setStatusFilters: (filters: ReportStatus[]) => void;
  teamsFilters: string[];
  setTeamsFilters: (filters: string[]) => void;
  filteredReports: myReportTableType[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

/**
 * Custom hook for filtering reports by status and team.
 * Returns filter state and filtered reports.
 */
export function useReportsTableFilters(
  reports: myReportTableType[],
  currentUserId: string | undefined,
  mode: ReportMode,
): UseReportsTableFiltersReturn {
  const [statusFilters, setStatusFilters] = useState<ReportStatus[]>([]);
  const [teamsFilters, setTeamsFilters] = useState<string[]>([]);
  const [selectedMyReports, setSelectedMyReports] = useState<boolean>(false);
  const [selectedMyAnsweredReports, setSelectedMyAnsweredReports] =
    useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  function handleMyReportsToggle() {
    setSelectedMyReports(!selectedMyReports);
  }
  function handleMyAnsweredReportsToggle() {
    setSelectedMyAnsweredReports(!selectedMyAnsweredReports);
  }

  // Filter reports based on selected statuses and teams
  // If no filters are active, return all reports except CLOSED (hidden by default)
  // Otherwise, filter reports that match at least one selected status AND one selected team
  const filteredReports = useMemo(() => {
    const hasStatusFilter = statusFilters.length > 0;
    const hasTeamFilter = teamsFilters.length > 0;
    const hasMyReportsFilter = selectedMyReports;
    const hasMyAnsweredReportsFilter = selectedMyAnsweredReports;
    const hasSearchQueryFilter = searchQuery.length > 0;

    // Early return if no filters are applied
    if (
      !hasStatusFilter &&
      !hasTeamFilter &&
      !hasMyReportsFilter &&
      !hasMyAnsweredReportsFilter &&
      !hasSearchQueryFilter
    )
      return reports;

    return reports.filter((report) => {
      // Match status: if no status filter is active, include all statuses
      // Otherwise, check if report status is in the selected statuses
      const matchesStatus = !hasStatusFilter
        ? true
        : statusFilters.includes(report.status);

      // Match team: if no team filter is active, always match
      // In CREATED mode, check applicantTeam; in REQUESTED mode, check requestedTeams
      const matchesTeam = (() => {
        if (!hasTeamFilter) return true;

        if (mode === ReportMode.CREATED) {
          return (
            report.applicantTeam?.id &&
            teamsFilters.includes(report.applicantTeam.id)
          );
        } else {
          // REQUESTED mode: check if any requestedTeam matches the filter
          return report.requestedTeams.some((team) =>
            teamsFilters.includes(team.id),
          );
        }
      })();

      const matchesMyReports = (() => {
        // If filter is not active, show all reports
        if (!hasMyReportsFilter) {
          return true;
        }

        // If no user ID, can't determine "my reports" - hide all when filter is active
        if (!currentUserId) {
          return false;
        }

        const userId = String(currentUserId).trim();
        const authorId = String(report.authorId).trim();

        // Check if user is the author
        if (authorId === userId && authorId.length > 0) {
          return true;
        }

        return false;
      })();

      const matchesMyAnsweredReports = (() => {
        if (!hasMyAnsweredReportsFilter) {
          return true;
        }
        // Utilise le flag pré-calculé côté serveur (optimisation)
        return report.hasUserAnswered ?? false;
      })();

      const matchesSearchQuery =
        !hasSearchQueryFilter ||
        (() => {
          const normalizedQuery = normalizeSearchQuery(searchQuery);
          const normalizedSubject = normalizeSearchQuery(report.subject);
          const normalizedFirstName = normalizeSearchQuery(report.firstName);
          const normalizedLastName = normalizeSearchQuery(report.lastName);
          const normalizedFullName = `${normalizedFirstName} ${normalizedLastName}`;

          // Check if query matches any field directly
          if (
            normalizedSubject.includes(normalizedQuery) ||
            normalizedFirstName.includes(normalizedQuery) ||
            normalizedLastName.includes(normalizedQuery) ||
            normalizedFullName.includes(normalizedQuery)
          ) {
            return true;
          }

          // Check if all words in query match any of the fields
          const queryWords = normalizedQuery
            .split(/\s+/)
            .filter((word) => word.length > 0);
          if (queryWords.length > 1) {
            return queryWords.every(
              (word) =>
                normalizedSubject.includes(word) ||
                normalizedFirstName.includes(word) ||
                normalizedLastName.includes(word) ||
                normalizedFullName.includes(word),
            );
          }

          return false;
        })();

      // Report must match both filters (if they are active)
      return (
        matchesStatus &&
        matchesTeam &&
        matchesMyReports &&
        matchesSearchQuery &&
        matchesMyAnsweredReports
      );
    });
  }, [
    selectedMyAnsweredReports,
    reports,
    statusFilters,
    teamsFilters,
    selectedMyReports,
    currentUserId,
    searchQuery,
    mode,
  ]);

  return {
    selectedMyReports,
    handleMyReportsToggle,
    selectedMyAnsweredReports,
    handleMyAnsweredReportsToggle,
    statusFilters,
    setStatusFilters,
    teamsFilters,
    setTeamsFilters,
    filteredReports,
    searchQuery,
    setSearchQuery,
  };
}
