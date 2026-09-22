import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useCreateAnswer } from "../../answer-section/render-choice/render-choice-form/use-create-answer";
import { Team } from "@/generated/prisma/browser";
import { useScrollToLastMessage } from "@/app/hooks/use-scroll-to-last-message";
import { SelectedOption, SelectedOptionEnum } from "../types";
import {
  createInviteGroupsSchema,
  InviteGroupsFormValues,
} from "./invite-groups.schema";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { TeamWithIncludes } from "@/types/request-group-selection";

interface UseInviteGroupsProps {
  alreadyLinkedRequestedTeamsIds: string[];
  authorsAndCoAuthorsIds: string[];
  reportId: string;
  reportApplicantTeam: Team | undefined;
  onResetSelection: () => void;
  selectedOption: SelectedOption;
  requestAreaId: string | undefined;
}

export function useInviteGroups({
  alreadyLinkedRequestedTeamsIds,
  authorsAndCoAuthorsIds,
  reportId,
  reportApplicantTeam,
  onResetSelection,
  selectedOption,
  requestAreaId,
}: UseInviteGroupsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUser = session?.user;

  const formMethods = useForm<InviteGroupsFormValues>({
    resolver: zodResolver(createInviteGroupsSchema()),
    mode: "onSubmit",
    defaultValues: {
      areaId: requestAreaId || "",
      teamIds: [],
      message: "",
    },
  });

  // get Me
  const { data: me } = useQuery(trpc.user.getCurrentUser.queryOptions());
  const meTeams = me?.teams ?? [];
  const { mutateAsync: addRequestedTeamsToReport, isPending } = useMutation(
    trpc.report.addRequestedTeamsToReport.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.report.getReportById.queryOptions(reportId),
        );
        queryClient.invalidateQueries(
          trpc.report.getRecipientsByReportId.queryOptions({
            reportId,
          }),
        );
        queryClient.invalidateQueries(
          trpc.answer.getAnswersWithStatusHistory.queryOptions(reportId),
        );
      },
      onError: () => {
        console.error("Error adding requested groups to request");
      },
    }),
  );

  const { mutateAsync: createAnswer, isPending: isCreatingAnswer } =
    useCreateAnswer();
  const { scrollToLastMessage } = useScrollToLastMessage({ reportId });

  function getMetadataAnswerContent(
    teamIds: string[],
    filteredRequestedTeams: TeamWithIncludes[] | undefined,
  ) {
    if (!filteredRequestedTeams?.length || !teamIds.length) return;

    const isAuthorOrCoAuthor = authorsAndCoAuthorsIds.includes(
      currentUser?.id ?? "",
    );

    function getTeamName() {
      // Si le user est destinataire du signalement, il faut afficher le nom de l'équipe demandée.
      // Si le user est auteur ou co-auteur du signalement, il faut afficher le nom de l'équipe demandeuse: reportApplicantTeam?.name

      if (isAuthorOrCoAuthor) {
        return reportApplicantTeam?.name;
      }
      return meTeams?.find((meTeam) =>
        alreadyLinkedRequestedTeamsIds.includes(meTeam.id),
      )?.name;
    }

    const teamName = getTeamName();

    const teams = filteredRequestedTeams
      .filter((team) => teamIds.includes(team.id))
      .map(
        (team) =>
          `<strong>${team.name}</strong> (${team.organization.shortName})</strong>`,
      )
      .join(", ");

    return ` ${teams} ${teamIds.length > 1 ? "ont" : "a"} rejoint la conversation sur invitation de ${currentUser?.firstName} ${currentUser?.lastName} ${teamName ? `(${teamName})` : ""}`;
  }

  async function onSubmit(
    data: InviteGroupsFormValues,
    filteredRequestedTeams: TeamWithIncludes[] | undefined,
  ) {
    await addRequestedTeamsToReport({
      reportId,
      teamIds: data.teamIds,
    });

    await createAnswer({
      reportId,
      content:
        getMetadataAnswerContent(data.teamIds, filteredRequestedTeams) ||
        "Une invitation a bien été envoyée aux groupes mais une erreur est survenue dans la récupération des groupes",
      isMetadataOnly: true,
      isIrrelevant: selectedOption === SelectedOptionEnum.IS_IRRELEVANT,
    });

    if (data.message?.trim()) {
      await createAnswer({
        reportId,
        content: data.message,
        isIrrelevant: selectedOption === SelectedOptionEnum.IS_IRRELEVANT,
      });
    }

    formMethods.reset({
      areaId: requestAreaId || "",
      teamIds: [],
      message: "",
    });
    onResetSelection();
    scrollToLastMessage();
  }

  return {
    formMethods,
    onSubmit: (filteredNotInvitedTeams: TeamWithIncludes[]) =>
      formMethods.handleSubmit((data) =>
        onSubmit(data, filteredNotInvitedTeams),
      ),
    isSubmitting: isPending || isCreatingAnswer,
  };
}
