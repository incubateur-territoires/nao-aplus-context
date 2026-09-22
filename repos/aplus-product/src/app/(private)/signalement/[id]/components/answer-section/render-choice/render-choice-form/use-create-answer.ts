import { useTRPC } from "@/trpc/client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useParams } from "next/navigation";

// use-create-answer.ts
export function useCreateAnswer() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { id: reportId } = useParams() as { id: string };

  return useMutation(
    trpc.answer.createAnswer.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.report.getReportById.queryOptions(reportId),
        );
        queryClient.invalidateQueries(
          trpc.answer.getAnswersWithStatusHistory.queryOptions(reportId),
        );
      },
    }),
  );
}
