"use client";

import { ActionChoice } from "./action-choice/action-choice";
import { AnswerList } from "./answer-list/answer-list";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "@/trpc/routers/_app";
import { useMemo } from "react";

export function AnswerSection({
  initialReport,
  initialAnswersData,
  currentUserId,
  userTimezone,
}: {
  initialReport: inferRouterOutputs<AppRouter>["report"]["getReportById"];
  initialAnswersData: inferRouterOutputs<AppRouter>["answer"]["getAnswersWithStatusHistory"];
  currentUserId: string | null;
  userTimezone: string;
}) {
  const { id } = useParams() as { id: string };
  const trpc = useTRPC();
  const { data: report } = useQuery({
    ...trpc.report.getReportById.queryOptions(id),
    initialData: initialReport,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const authorsIds = useMemo(
    () => [
      report?.authorId,
      ...(report?.coAuthors?.map((coAuthor) => coAuthor.id) ?? []),
    ],
    [report],
  );
  const isAuthor = authorsIds.includes(currentUserId ?? "");

  const shouldShowActionChoice =
    report &&
    report.status !== "CLOSED" &&
    report.status !== "DELETED" &&
    !(isAuthor && report.status === "COMPLETED");

  return (
    <div>
      <AnswerList
        requestId={id}
        initialData={initialAnswersData}
        currentUserId={currentUserId}
        initialReport={report}
        userTimezone={userTimezone}
      />

      {shouldShowActionChoice ? (
        <ActionChoice currentStatus={report.status} isAuthor={isAuthor} />
      ) : null}
    </div>
  );
}
