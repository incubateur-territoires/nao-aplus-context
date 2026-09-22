"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ReportsTable } from "../reports-table/reports-table/reports-table";
import { ReportMode } from "@/types/report-mode";

// Paramètres initiaux pour vérifier si la liste est vide
const initialQueryInput = {
  page: 1,
  pageSize: 10,
  status: undefined,
  teamIds: undefined,
  search: undefined,
  myReportsOnly: undefined,
  myAnsweredOnly: undefined,
  sortBy: "lastMessage" as const,
  sortOrder: "desc" as const,
};

export function RequestList({ mode, id }: { mode: ReportMode; id?: string }) {
  const trpc = useTRPC();
  const { data: currentUser } = useSuspenseQuery(
    trpc.user.getCurrentUser.queryOptions(),
  );

  // Vérifier si la liste initiale est vide (requête dédupliquée par TanStack Query)
  const queryOptions =
    mode === ReportMode.CREATED
      ? trpc.report.getMyCreatedReportsTable.queryOptions(initialQueryInput)
      : trpc.report.getMyRequestedReportsTable.queryOptions(initialQueryInput);

  const { data } = useSuspenseQuery(queryOptions);

  // Ne pas afficher le bloc si aucun signalement
  if (data.pagination.totalCount === 0) {
    return null;
  }

  return (
    <div
      id={id}
      className="p-4 sm:p-8 md:p-12 lg:p-20 bg-white mt-2 sm:mt-6 relative scroll-mt-4"
    >
      <ReportsTable currentUser={currentUser} mode={mode} />
    </div>
  );
}
