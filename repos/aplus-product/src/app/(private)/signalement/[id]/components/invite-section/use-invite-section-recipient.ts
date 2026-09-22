import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useParams } from "next/navigation";
import { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { AppRouter } from "@/trpc/routers/_app";
import { ReportStatus } from "@/generated/prisma/enums";
import { useMemo } from "react";
import { SelectedOption } from "./types";

type Report = inferRouterOutputs<AppRouter>["report"]["getReportById"];

interface UseInviteSectionRecipientProps {
  initialReport: Report;
}

export function useInviteSectionRecipient({
  initialReport,
}: UseInviteSectionRecipientProps) {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();

  const { data: report } = useQuery({
    ...trpc.report.getReportById.queryOptions(id),
    initialData: initialReport,
  });

  const { data: currentUser } = useQuery({
    ...trpc.user.getCurrentUser.queryOptions(),
  });

  const [selectedOption, setSelectedOption] = useState<SelectedOption>(null);

  const alreadyLinkedRequestedTeamsIds = useMemo(
    () => report?.requestedTeams.map((group) => group.id) ?? [],
    [report?.requestedTeams],
  );

  const mergedAlreadyLinkedRequestedTeamsIds = useMemo(
    () => [...alreadyLinkedRequestedTeamsIds, report?.applicantTeamId ?? ""],
    [alreadyLinkedRequestedTeamsIds, report?.applicantTeamId],
  );

  const instructorRequestedTeam = useMemo(() => {
    if (!currentUser?.teams || !report?.requestedTeams) return null;

    const userTeamIds = currentUser.teams.map((team) => team.id);
    const matchingTeam = report.requestedTeams.find((requestedTeam) =>
      userTeamIds.includes(requestedTeam.id),
    );

    return matchingTeam?.name ?? null;
  }, [currentUser?.teams, report?.requestedTeams]);

  const isClosed = report?.status === ReportStatus.CLOSED;

  return {
    report,
    isClosed,
    mergedAlreadyLinkedRequestedTeamsIds,
    selectedOption,
    setSelectedOption,
    instructorRequestedTeam,
  };
}
