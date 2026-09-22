"use client";

import { useEffect, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTRPCPredicate } from "@/utils/query-invalidation";

interface ReportViewTrackerProps {
  reportId: string;
}

export function ReportViewTracker({ reportId }: ReportViewTrackerProps) {
  const hasMarked = useRef(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const markAsViewedMutation = useMutation(
    trpc.answer.markReportAsViewed.mutationOptions(),
  );

  useEffect(() => {
    if (hasMarked.current) return;
    hasMarked.current = true;

    markAsViewedMutation.mutate(
      { reportId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            predicate: createTRPCPredicate(
              "answer",
              "getUnreadCountsByReports",
            ),
          });
        },
      },
    );
  }, [reportId, markAsViewedMutation, queryClient]);

  return null;
}
