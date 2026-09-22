import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useCreateAnswer } from "../../answer-section/render-choice/render-choice-form/use-create-answer";
import { Team } from "@/generated/prisma/browser";
import { useScrollToLastMessage } from "@/app/hooks/use-scroll-to-last-message";
import {
  inviteColleagueSchema,
  InviteColleagueFormValues,
} from "./invite-colleague.schema";
import { useSession } from "@/lib/auth-client";

interface ColleagueSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface UseInviteColleagueProps {
  reportId: string;
  colleaguesToInvite: ColleagueSummary[];
  reportAuthor: { id: string; firstName: string; lastName: string } | undefined;
  reportApplicantTeam: Team | undefined;
  onResetSelection: () => void;
}

export function useInviteCoAuthors({
  reportId,
  colleaguesToInvite,
  reportApplicantTeam,
  onResetSelection,
}: UseInviteColleagueProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUser = session?.user;
  const formMethods = useForm<InviteColleagueFormValues>({
    resolver: zodResolver(inviteColleagueSchema),
    mode: "onSubmit",
    defaultValues: {
      colleagueIds: [],
      message: "",
    },
  });

  const { mutateAsync: addCoAuthorsToReport, isPending } = useMutation(
    trpc.report.addCoAuthorsToReport.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.report.getReportById.queryOptions(reportId),
        );
      },
    }),
  );

  const { mutateAsync: createAnswer, isPending: isCreatingAnswer } =
    useCreateAnswer();
  const { scrollToLastMessage } = useScrollToLastMessage({ reportId });

  function getMetadataContent(colleagueIds: string[]) {
    if (!colleagueIds.length) return;

    const colleagues = colleaguesToInvite
      ?.filter((colleague) => colleagueIds.includes(colleague.id))
      .map(
        (colleague) =>
          `<strong>${colleague.firstName && colleague.lastName ? `${colleague.firstName} ${colleague.lastName}` : colleague.email}</strong>`,
      )
      .join(", ");

    return ` ${colleagues} </br> ${colleagueIds.length > 1 ? "ont" : "a"} rejoint la conversation sur invitation de ${currentUser?.firstName} ${currentUser?.lastName} (${reportApplicantTeam?.name})`;
  }

  async function onSubmit(data: InviteColleagueFormValues) {
    await addCoAuthorsToReport({
      reportId,
      coAuthorIds: data.colleagueIds,
    });

    await createAnswer({
      reportId,
      content:
        getMetadataContent(data.colleagueIds) ||
        "Une invitation a bien été envoyée aux membres de l'équipe mais une erreur est survenue dans la récupération des membres de l'équipe",
      isMetadataOnly: true,
    });

    if (data.message?.trim()) {
      await createAnswer({
        reportId,
        content: data.message,
      });
    }

    formMethods.reset();
    onResetSelection();
    scrollToLastMessage();
  }

  return {
    formMethods,
    onSubmit: formMethods.handleSubmit(onSubmit),
    isSubmitting: isPending || isCreatingAnswer,
  };
}
