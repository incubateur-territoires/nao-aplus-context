import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTRPCPredicate } from "@/utils/query-invalidation";

export function useStatusViewTracking(
  statusHistoryId: string,
  enabled: boolean,
) {
  const [hasBeenMarked, setHasBeenMarked] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const markAsViewedMutation = useMutation(
    trpc.answer.markStatusChangeAsViewed.mutationOptions(),
  );

  useEffect(() => {
    if (!enabled || hasBeenMarked || !elementRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
              if (!hasBeenMarked) {
                markAsViewedMutation.mutate(
                  { statusHistoryId },
                  {
                    onSuccess: () => {
                      setHasBeenMarked(true);
                      queryClient.invalidateQueries({
                        predicate: createTRPCPredicate(
                          "answer",
                          "getUnreadCountsByReports",
                        ),
                      });
                    },
                  },
                );
              }
            }, 1000);
          } else {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
          }
        });
      },
      {
        threshold: 0.5,
      },
    );

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    statusHistoryId,
    enabled,
    hasBeenMarked,
    markAsViewedMutation,
    queryClient,
  ]);

  return { elementRef, hasBeenMarked };
}
