"use client";

import { ReportStatusBadge } from "@/app/component/request-status-badge/request-status-badge";
import { OverdueBadge } from "@/app/component/overdue-badge/overdue-badge";
import { Documents } from "../documents/documents";
import { CitizenInfos } from "../citizen-infos/citizen-infos";
import { AuthorInfos } from "../author-infos/author-infos";
import { RecipientsInfos } from "../recipients-infos/recipients-infos";
import { Informations } from "../informations/informations";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "@/trpc/routers/_app";
import { CopyUrlButton } from "../copy-url-button/copy-url-button";
import { PrintButton } from "../print-button/print-button";

export function ReportContent({
  initialReport,
  userTimezone,
}: {
  initialReport: inferRouterOutputs<AppRouter>["report"]["getReportById"];
  userTimezone: string;
}) {
  const { id } = useParams() as { id: string };
  const trpc = useTRPC();
  const { data: report } = useQuery({
    ...trpc.report.getReportById.queryOptions(id),
    initialData: initialReport,
  });

  return (
    <div className="p-4 md:p-20 bg-white mt-8 relative">
      <div className="flex items-center gap-4 justify-between mb-4">
        <div className="flex items-center gap-2">
          <ReportStatusBadge status={report?.status} />
          <OverdueBadge overdueAt={report?.overdueAt ?? null} />
        </div>
        <CopyUrlButton />
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="mt-6 mb-10 w-full md:w-2/3">
          <h2>{report?.subject}</h2>
          <p className="text-md whitespace-pre-wrap">{report?.description}</p>
          <Documents files={report?.files || []} />
        </div>
        <div className="w-full md:w-1/3 flex flex-col md:pl-6">
          <CitizenInfos report={report ?? null} userTimezone={userTimezone} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-10 mt-16">
        <AuthorInfos report={report ?? null} />
        <RecipientsInfos reportId={report?.id} />
        <div className="flex flex-col justify-between gap-4">
          <Informations report={report ?? null} userTimezone={userTimezone} />
          <div className="flex justify-end">
            <PrintButton />
          </div>
        </div>
      </div>
    </div>
  );
}
