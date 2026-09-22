"use client";

import { useMemo } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { AnswerItem } from "./answer-item/answer-item";
import { StatusTimelineEntry } from "./status-timeline-entry/status-timeline-entry";
import { CloseSection } from "./close-section/close-section";
import { STYLES } from "./styles";
import { buildTimeline, groupTimeline } from "./utils";
import { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "@/trpc/routers/_app";
import { useSession } from "@/app/component/auth-provider/auth-provider";

interface AnswerListProps {
  requestId: string;
  initialData: inferRouterOutputs<AppRouter>["answer"]["getAnswersWithStatusHistory"];
  currentUserId: string | null;
  initialReport: inferRouterOutputs<AppRouter>["report"]["getReportById"];
  userTimezone: string;
}

export function AnswerList({
  requestId,
  initialData,
  currentUserId: serverCurrentUserId,
  initialReport,
  userTimezone,
}: AnswerListProps) {
  const { data: session } = useSession();
  // Use server-provided userId for initial render, then sync with client session
  const currentUserId = session?.user?.id ?? serverCurrentUserId;
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.answer.getAnswersWithStatusHistory.queryOptions(requestId),
    initialData,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const timelineItems = useMemo(
    () => buildTimeline(data?.answers ?? [], data?.statusHistory ?? []),
    [data?.answers, data?.statusHistory],
  );

  // Regroupe par étape de statut pour une structure de liste sémantique.
  const timelineGroups = useMemo(
    () => groupTimeline(timelineItems),
    [timelineItems],
  );

  return (
    <div className={STYLES.container}>
      <h2>Évolution du signalement</h2>
      {timelineItems.length === 0 ? (
        <p className="text-gray-500">Aucune conversation pour le moment.</p>
      ) : (
        <div className={STYLES.conversationsWrapper} id="answer-list">
          <ol className="list-none marker:content-none flex flex-col m-0 p-0">
            {timelineGroups.map((group, groupIndex) => (
              <li
                key={
                  group.status
                    ? `status-${group.status.id}`
                    : `answers-${groupIndex}`
                }
              >
                {group.status && (
                  <StatusTimelineEntry
                    status={group.status}
                    userTimezone={userTimezone}
                  />
                )}
                {group.answers.length > 0 && (
                  <ol className="list-none marker:content-none flex flex-col m-0 p-0">
                    {group.answers.map((item) => {
                      const isAuthorAnswer =
                        currentUserId === item.answer.authorId;
                      return (
                        <li
                          className="message-container"
                          key={`answer-${item.answer.id}`}
                        >
                          <AnswerItem
                            answer={item.answer}
                            isAuthorAnswer={isAuthorAnswer}
                            answers={data?.answers ?? []}
                            currentIndex={item.index}
                            hasStatusAfter={item.hasStatusAfter}
                            userTimezone={userTimezone}
                          />
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            ))}
          </ol>
          <CloseSection initialReport={initialReport} />
        </div>
      )}
    </div>
  );
}
