import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

interface UseScrollToLastMessageOptions {
  containerId?: string;
  delay?: number;
  offset?: number;
  reportId?: string;
}

export function useScrollToLastMessage(
  options: UseScrollToLastMessageOptions = {},
) {
  const { containerId = "answer-list", offset = -100, reportId } = options;
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  function scrollToLastMessage() {
    const performScroll = () => {
      requestAnimationFrame(() => {
        // Find all elements with class="message-container"
        const messageContainers =
          document.querySelectorAll(".message-container");

        if (messageContainers.length > 0) {
          // Get the last message container
          const lastMessageContainer =
            messageContainers[messageContainers.length - 1];
          const rect = lastMessageContainer.getBoundingClientRect();
          const scrollTop =
            window.pageYOffset || document.documentElement.scrollTop;
          const targetPosition = rect.top + scrollTop + offset;

          window.scrollTo({
            top: targetPosition,
            behavior: "smooth",
          });
        } else {
          // Fallback: scroll to the container itself
          const container = document.getElementById(containerId);
          if (container) {
            const rect = container.getBoundingClientRect();
            const scrollTop =
              window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop + offset;

            window.scrollTo({
              top: targetPosition,
              behavior: "smooth",
            });
          }
        }
      });
    };

    if (reportId) {
      // Refetch queries and wait for them to complete before scrolling
      const refetchPromise = Promise.all([
        queryClient.refetchQueries(
          trpc.report.getReportById.queryOptions(reportId),
        ),
        queryClient.refetchQueries(
          trpc.answer.getAnswersWithStatusHistory.queryOptions(reportId),
        ),
      ]);
      refetchPromise.then(() => {
        performScroll();
      });
    } else {
      // No reportId provided, scroll immediately
      performScroll();
    }
  }

  return { scrollToLastMessage };
}
