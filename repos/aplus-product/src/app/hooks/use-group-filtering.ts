import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { TeamWithIncludes } from "@/types/request-group-selection";

interface UseGroupFilteringParams {
  reportId?: string;
  areaIds?: string[];
  applicantTeamId?: string;
}

export function useGroupFiltering(
  params: UseGroupFilteringParams,
  aleadyLinkedRequestedTeamsIds: string[] = [],
) {
  const trpc = useTRPC();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  // Fetch teams based on what parameter is provided
  const { data: teamsByReport, isLoading: isLoadingByReport } = useQuery({
    ...trpc.team.getNotInvitedTeamsByReportId.queryOptions({
      reportId: params.reportId ?? "",
    }),
    enabled: !!params.reportId,
  });

  const { data: teamsByArea, isLoading: isLoadingByArea } = useQuery({
    ...trpc.team.getActiveOperatorTeamsByAreaIds.queryOptions({
      areaIds: params.areaIds ?? [],
      applicantTeamId: params.applicantTeamId ?? "",
    }),
    enabled:
      !!params.areaIds && params.areaIds.length > 0 && !!params.applicantTeamId,
  });

  const notInvitedTeams = params.reportId ? teamsByReport : teamsByArea;
  const isLoadingNotInvitedTeams = params.reportId
    ? isLoadingByReport
    : isLoadingByArea;

  const notInvitedTeamsWithTags = useMemo(() => {
    return (
      notInvitedTeams
        ?.filter((team) => !aleadyLinkedRequestedTeamsIds.includes(team.id))
        .map((team) => ({
          ...team,
          tags: {
            label: team.name,
            value: team.organization.tags.map((tag) => tag.id),
          },
        })) ?? []
    );
  }, [notInvitedTeams, aleadyLinkedRequestedTeamsIds]);

  const filteredNotInvitedTeams: TeamWithIncludes[] = useMemo(() => {
    const teams =
      selectedFilters.length === 0
        ? notInvitedTeamsWithTags
        : notInvitedTeamsWithTags.filter((team) =>
            team.tags.value.some((tag) => selectedFilters.includes(tag)),
          );
    return [...teams].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [notInvitedTeamsWithTags, selectedFilters]);

  const tags = useMemo(() => {
    if (!notInvitedTeamsWithTags) return [];

    const allTags = notInvitedTeamsWithTags.flatMap((group) =>
      group.organization.tags.map((tag) => ({
        label: tag.name,
        value: tag.id,
      })),
    );

    const uniqueTags = allTags.filter(
      (tag, index, self) =>
        self.findIndex((t) => t.value === tag.value) === index,
    );

    return uniqueTags;
  }, [notInvitedTeamsWithTags]);

  return {
    notInvitedTeams,
    filteredNotInvitedTeams,
    isLoadingNotInvitedTeams,
    tags,
    selectedFilters,
    setSelectedFilters,
  };
}
