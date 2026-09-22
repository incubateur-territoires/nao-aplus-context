"use client";
import { ReportStatus } from "@/generated/prisma/enums";
import { useTRPC } from "@/trpc/client";
import { AppRouter } from "@/trpc/routers/_app";
import Button from "@codegouvfr/react-dsfr/Button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inferRouterOutputs } from "@trpc/server";
import { useParams } from "next/navigation";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { useMemo } from "react";
import { createTRPCPredicate } from "@/utils/query-invalidation";
import { USER_ROLES } from "@/constants/user-roles";

export function CloseSection({
  initialReport,
}: {
  initialReport: inferRouterOutputs<AppRouter>["report"]["getReportById"];
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const authorsIds = useMemo(
    () => [
      initialReport?.authorId,
      ...(initialReport?.coAuthors?.map((coAuthor) => coAuthor.id) ?? []),
    ],
    [initialReport],
  );
  const isAuthor = authorsIds.includes(currentUserId ?? "");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
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
      },
      onError: () => {
        console.error("Error updating request status");
      },
    }),
  );

  const isCompleted = report?.status === ReportStatus.COMPLETED;

  const isAdmin = session?.user?.role === USER_ROLES.ADMIN;

  if (!isAuthor && !isAdmin) {
    return null;
  }
  if (!isCompleted) {
    return null;
  }
  return (
    <div className="bg-blue-background mt-8 flex flex-col gap-2 p-8">
      <h5 className="text-[22px] font-bold leading-[28px] text-black m-0">
        Fermer le signalement
      </h5>
      <p className="text-[16px] leading-[24px] text-[#3a3a3a] m-0">
        Le blocage du citoyen est résolu.
        <br />
        Un signalement fermé reste accessible pendant 6 mois. Pendant cette
        période, il peut être rouvert à tout moment.
        <br />6 mois après sa fermeture, le signalement est supprimé.
        <br />
        <br />
        Un signalement traité sera automatiquement fermé au bout de 30 jours.
      </p>
      <div className="flex justify-end pt-2">
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
