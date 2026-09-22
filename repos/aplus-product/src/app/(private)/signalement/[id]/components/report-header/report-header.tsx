"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export function ReportHeader({ reportId }: { reportId: string }) {
  const trpc = useTRPC();
  const { data: report } = useSuspenseQuery(
    trpc.report.getReportById.queryOptions(reportId),
  );

  if (!report) return null;

  return (
    <h1>
      Signalement de {report.firstName} {report.lastName} le{" "}
      {report.createdAt.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })}
    </h1>
  );
}
