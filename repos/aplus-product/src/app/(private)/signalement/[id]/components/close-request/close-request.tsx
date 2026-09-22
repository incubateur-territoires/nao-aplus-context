"use client";
import { ReportStatus } from "@/generated/prisma/enums";
import { useTRPC } from "@/trpc/client";
import { AppRouter } from "@/trpc/routers/_app";
import Button from "@codegouvfr/react-dsfr/Button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inferRouterOutputs } from "@trpc/server";
import { useParams } from "next/navigation";
import { useScrollToLastMessage } from "@/app/hooks/use-scroll-to-last-message";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { createTRPCPredicate } from "@/utils/query-invalidation";
import { USER_ROLES } from "@/constants/user-roles";

export function CloseRequest({
  initialReport,
}: {
  initialReport: inferRouterOutputs<AppRouter>["report"]["getReportById"];
}) {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { scrollToLastMessage } = useScrollToLastMessage({ reportId: id });

  // Get current user with teams to check team roles
  const { data: currentUser } = useQuery(
    trpc.user.getCurrentUser.queryOptions(undefined, {
      enabled: !!session?.user,
    }),
  );

  // Check if user has any team with OPERATOR role
  const isAuthorOrCoAuthor = [
    initialReport?.authorId,
    ...(initialReport?.coAuthors?.map((coAuthor) => coAuthor.id) ?? []),
  ].includes(currentUser?.id ?? "");

  const { data: report } = useQuery({
    ...trpc.report.getReportById.queryOptions(id),
    initialData: initialReport,
  });
  const { mutateAsync: updateReportStatus, isPending } = useMutation(
    trpc.report.updateReportStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.report.getReportById.queryOptions(id),
        );
        queryClient.invalidateQueries(
          trpc.answer.getAnswersWithStatusHistory.queryOptions(id),
        );
        // Invalidate report tables to update status in the list
        queryClient.invalidateQueries({
          predicate: createTRPCPredicate("report", [
            "getMyCreatedReportsTable",
            "getMyRequestedReportsTable",
          ]),
        });
        scrollToLastMessage();
      },
      onError: () => {
        console.error("Error updating request status");
        queryClient.invalidateQueries(
          trpc.report.getReportById.queryOptions(id),
        );
        queryClient.invalidateQueries(
          trpc.answer.getAnswersWithStatusHistory.queryOptions(id),
        );
      },
    }),
  );

  const isClosed = report?.status === ReportStatus.CLOSED;

  const isAdmin = session?.user?.role === USER_ROLES.ADMIN;

  if (!isAuthorOrCoAuthor && !isAdmin) {
    return null;
  }

  // Les auteurs, co-auteurs et admins peuvent fermer un signalement.
  // La réouverture d'un signalement fermé est désormais gérée par
  // BackToInTreatmentSection ("Repasser le signalement En cours de
  // traitement"), on n'affiche donc plus de bloc ici dans ce cas.
  if (isClosed) {
    return null;
  }

  return (
    <div className="bg-white p-20 flex flex-col gap-6 mt-10">
      <h2 className="text-[32px] font-bold leading-[40px] text-[#161616] m-0">
        Fermer le signalement
      </h2>
      <p>
        Le blocage du citoyen est résolu.
        <br /> <br />
        Un signalement fermé reste accessible pendant 6 mois. Pendant cette
        période, il peut être rouvert à tout moment. <br />
        Six mois après sa fermeture, le signalement est supprimé.
        <br />
        <br />
        Un signalement traité sera automatiquement fermé au bout de 30 jours.
      </p>
      <div className="flex justify-end">
        <Button
          size="large"
          disabled={isPending}
          onClick={() => {
            updateReportStatus({ id, status: ReportStatus.CLOSED });
          }}
        >
          Fermer le signalement
        </Button>
      </div>
    </div>
  );
}
