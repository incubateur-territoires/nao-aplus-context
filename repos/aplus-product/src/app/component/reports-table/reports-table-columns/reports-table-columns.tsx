import { ColumnDef } from "@tanstack/react-table";
import { ReportStatusBadge } from "../../request-status-badge/request-status-badge";
import { OverdueBadge } from "../../overdue-badge/overdue-badge";
import Button from "@codegouvfr/react-dsfr/Button";
import { ROUTE } from "@/app/constant/route";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import {
  formatDate,
  getLastMessageDate,
} from "../reports-table-utils/reports-table.utils";
import { highlightText } from "../reports-table-utils/highlight-text";
import { ReportStatus } from "@/generated/prisma/enums";

type Report =
  inferRouterOutputs<AppRouter>["report"]["getMyCreatedReportsTable"]["reports"][number];

export function getReportsTableColumns(
  searchQuery?: string,
  unreadCounts?: Record<string, number>,
  unviewedReportIds?: Set<string>,
): ColumnDef<Report>[] {
  return [
    {
      id: "citizen-subject",
      meta: { cellClassName: "", sortType: "alpha" },
      header: () => (
        <div>
          <div>Nom du citoyen</div>
          <div className="text-xs font-normal text-[#3A3A3A] mt-1">
            Sujet du signalement
          </div>
        </div>
      ),
      accessorFn: (row) => `${row.lastName} ${row.firstName}`,
      cell: ({ row }) => {
        const isUnviewed =
          row.original.status !== ReportStatus.CLOSED &&
          unviewedReportIds?.has(row.original.id);
        return (
          <div className="flex items-start gap-2">
            {isUnviewed && (
              <>
                <span
                  className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="sr-only">Nouveau signalement</span>
              </>
            )}
            <div className="flex flex-col items-start">
              <div className="font-bold text-base leading-6 text-[#3A3A3A]">
                {highlightText(row.original.firstName, searchQuery || "")}{" "}
                {highlightText(row.original.lastName, searchQuery || "")}
              </div>
              <div className="text-sm leading-6 text-[#3A3A3A]">
                {highlightText(row.original.subject, searchQuery || "")}
              </div>
              <div className="pt-2">
                <ReportStatusBadge status={row.original.status} small />
              </div>
            </div>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "author",
      meta: { sortType: "alpha" },
      header: () => (
        <div>
          <div>Nom de l’auteur</div>
          <div className="text-xs font-normal text-[#3A3A3A] mt-1">
            Équipe de l’auteur
          </div>
        </div>
      ),
      accessorFn: (row) => `${row.author?.lastName} ${row.author?.firstName}`,
      cell: ({ row }) => {
        const author = row.original.author;
        const locationLabel = row.original.applicantTeam?.name;
        return (
          <div className="flex flex-col items-start">
            {author && (author.firstName || author.lastName) && (
              <div className="font-medium text-sm leading-6 text-[#3A3A3A]">
                {[author.firstName, author.lastName].filter(Boolean).join(" ")}
              </div>
            )}
            {locationLabel && (
              <div className="text-xs leading-5 text-[#3A3A3A]">
                {locationLabel}
              </div>
            )}
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "createdAt",
      header: "Création",
      accessorKey: "createdAt",
      meta: { sortType: "date" },
      cell: ({ row }) => formatDate(row.original.createdAt),
      enableSorting: true,
    },
    {
      id: "lastMessage",
      header: "Dernier msg",
      accessorFn: (row) => getLastMessageDate(row),
      meta: { sortType: "date" },
      cell: ({ row }) => {
        const lastMsg = getLastMessageDate(row.original);
        return (
          <div className="flex flex-col gap-1 items-start">
            <span>{lastMsg ? formatDate(lastMsg) : "-"}</span>
            <OverdueBadge overdueAt={row.original.overdueAt} small />
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "unreadCount",
      header: () => <span className="sr-only">Non lu</span>,
      cell: ({ row }) => {
        if (row.original.status === ReportStatus.CLOSED) return null;
        const count = unreadCounts?.[row.original.id] || 0;
        if (count === 0) return null;
        return (
          <div className="flex justify-center">
            <div
              className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
              aria-label={`${count} message${count > 1 ? "s" : ""} non lu${count > 1 ? "s" : ""}`}
              role="status"
            >
              {count}
            </div>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            iconId="ri-arrow-right-line"
            iconPosition="right"
            priority="primary"
            size="small"
            linkProps={{
              href: ROUTE.REPORT_WITH_ID.replace(":id", row.original.id),
            }}
          >
            Voir
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
