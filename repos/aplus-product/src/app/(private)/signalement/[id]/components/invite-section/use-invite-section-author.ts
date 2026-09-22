import { useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { AppRouter } from "@/trpc/routers/_app";
import { ReportStatus } from "@/generated/prisma/enums";
import { SelectedOption, SelectedOptionEnum } from "./types";

type Report = inferRouterOutputs<AppRouter>["report"]["getReportById"];

interface UseInviteSectionAuthorProps {
  initialReport: Report;
}

export function useInviteSectionAuthor({
  initialReport,
}: UseInviteSectionAuthorProps) {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();

  const { data: report } = useQuery({
    ...trpc.report.getReportById.queryOptions(id),
    initialData: initialReport,
  });

  const { data: allColleagues, isLoading } = useQuery({
    ...trpc.team.getColleaguesByTeamId.queryOptions(
      report?.applicantTeamId ?? "",
    ),
    enabled:
      !!report?.applicantTeamId && report?.status !== ReportStatus.CLOSED,
  });

  const colleaguesToInvite = useMemo(
    () =>
      allColleagues
        ?.filter(
          (colleague) => !report?.coAuthors?.some((c) => c.id === colleague.id),
        )
        .filter((colleague) => colleague.id !== report?.author?.id) || [],
    [allColleagues, report?.coAuthors, report?.author?.id],
  );

  const showColleaguesToInvite = colleaguesToInvite.length > 0;

  const [selectedOption, setSelectedOption] = useState<SelectedOption>(null);

  const effectiveSelectedOption =
    selectedOption ??
    (showColleaguesToInvite ? SelectedOptionEnum.COLLEAGUES : null);

  function handleOptionChange(option: SelectedOption) {
    setSelectedOption(option);
  }

  const alreadyLinkedRequestedTeamsIds = useMemo(
    () => report?.requestedTeams?.map((group) => group.id) ?? [],
    [report?.requestedTeams],
  );

  const mergedAlreadyLinkedRequestedTeamsIds = useMemo(
    () => [...alreadyLinkedRequestedTeamsIds, report?.applicantTeamId ?? ""],
    [alreadyLinkedRequestedTeamsIds, report?.applicantTeamId],
  );

  const isClosed = report?.status === ReportStatus.CLOSED;

  return {
    report,
    isLoading,
    isClosed,
    colleaguesToInvite,
    showColleaguesToInvite,
    selectedOption,
    effectiveSelectedOption,
    mergedAlreadyLinkedRequestedTeamsIds,
    setSelectedOption: handleOptionChange,
  };
}
