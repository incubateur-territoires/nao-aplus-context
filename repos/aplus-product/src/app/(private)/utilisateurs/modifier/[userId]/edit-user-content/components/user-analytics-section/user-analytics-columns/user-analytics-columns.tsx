"use client";

import Badge from "@codegouvfr/react-dsfr/Badge";
import Tag from "@codegouvfr/react-dsfr/Tag";
import type { ColumnDef } from "@tanstack/react-table";

export interface UserAnalyticsRow {
  id: string;
  date: string;
  description: string;
  // L'utilisateur consulté a subi l'action (désactivation, impersonation...).
  isTarget: boolean;
  categoryLabel: string;
  pagePath: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
}

export function getUserAnalyticsColumns(): ColumnDef<UserAnalyticsRow>[] {
  return [
    {
      accessorKey: "date",
      header: "Date",
      meta: { cellClassName: "whitespace-nowrap" },
    },
    {
      accessorKey: "description",
      header: "Événement",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          {row.original.isTarget && (
            <Badge severity="info" small noIcon>
              Cible
            </Badge>
          )}
          <span>{row.original.description}</span>
        </div>
      ),
    },
    {
      accessorKey: "categoryLabel",
      header: "Catégorie",
      cell: ({ row }) => <Tag small>{row.original.categoryLabel}</Tag>,
    },
    {
      accessorKey: "pagePath",
      header: "Page",
      cell: ({ row }) =>
        row.original.pagePath ? (
          <span className="break-all">{row.original.pagePath}</span>
        ) : (
          "—"
        ),
    },
    {
      id: "details",
      header: "Détails",
      cell: ({ row }) => {
        const { ipAddress, userAgent, metadata } = row.original;
        const hasMetadata =
          metadata !== null &&
          metadata !== undefined &&
          (typeof metadata !== "object" ||
            Object.keys(metadata as object).length > 0);

        if (!ipAddress && !userAgent && !hasMetadata) {
          return "—";
        }

        return (
          <details>
            <summary className="cursor-pointer text-blue-primary">
              Détails techniques
            </summary>
            <div className="mt-2 flex flex-col gap-1 text-xs">
              {ipAddress && (
                <p className="m-0">
                  <strong>IP :</strong> {ipAddress}
                </p>
              )}
              {userAgent && (
                <p className="m-0 break-all">
                  <strong>Navigateur :</strong> {userAgent}
                </p>
              )}
              {hasMetadata && (
                <pre className="m-0 max-w-[320px] overflow-x-auto whitespace-pre-wrap break-all bg-[#F6F6F6] p-2">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              )}
            </div>
          </details>
        );
      },
    },
  ];
}
