import { useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { AppRouter } from "@/trpc/routers/_app";
import { ReportStatus } from "@/generated/prisma/enums";
import { SelectedOption, SelectedOptionEnum } from "./types";
type Report = inferRouterOutputs<AppRouter>["report"]["getReportById"];

interface UseInviteSectionProps {
  initialReport: Report;
  isInstructor: boolean;
}

export function useInviteSection({
  initialReport,
  isInstructor,
}: UseInviteSectionProps) {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();

  // Fetch report data
  const { data: report } = useQuery({
    ...trpc.report.getReportById.queryOptions(id),
    initialData: initialReport,
  });

  // Fetch colleagues data
  const { data: allColleagues, isLoading } = useQuery({
    ...trpc.team.getColleaguesByTeamId.queryOptions(
      report?.applicantTeamId ?? "",
    ),
    enabled:
      !!report?.applicantTeamId && report?.status !== ReportStatus.CLOSED,
  });

  // Calculate coAuthors to invite (filter out already coAutors)
  const coAuthorsToInvite = useMemo(
    () =>
      allColleagues?.filter(
        (colleague) => !report?.coAuthors?.some((c) => c.id === colleague.id),
      ) || [],
    [allColleagues, report?.coAuthors],
  );

  const showcoAuthorsToInviteToInvite = coAuthorsToInvite.length > 0;

  // Selected option state
  const [selectedOption, setSelectedOption] = useState<SelectedOption>(
    isInstructor ? SelectedOptionEnum.ORGANIZATIONS : null,
  );

  // Derive the effective selected option from state and data
  const effectiveSelectedOption = isInstructor
    ? SelectedOptionEnum.ORGANIZATIONS
    : (selectedOption ??
      (showcoAuthorsToInviteToInvite ? SelectedOptionEnum.COLLEAGUES : null));

  // Calculate already linked team IDs
  const alreadyLinkedRequestedTeamsIds = useMemo(
    () => report?.requestedTeams.map((group) => group.id) ?? [],
    [report?.requestedTeams],
  );

  // Merge with applicant team ID
  const mergedAlreadyLinkedRequestedTeamsIds = useMemo(
    () => [...alreadyLinkedRequestedTeamsIds, report?.applicantTeamId ?? ""],
    [alreadyLinkedRequestedTeamsIds, report?.applicantTeamId],
  );

  // Check if report is closed
  const isClosed = report?.status === ReportStatus.CLOSED;

  return {
    report,
    isLoading,
    isClosed,
    coAuthorsToInvite,
    showcoAuthorsToInviteToInvite,
    selectedOption,
    effectiveSelectedOption,
    mergedAlreadyLinkedRequestedTeamsIds,
    setSelectedOption,
  };
}
