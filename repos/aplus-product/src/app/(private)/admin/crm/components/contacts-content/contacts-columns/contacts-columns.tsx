import type { ColumnDef } from "@tanstack/react-table";
import type { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import type { AppRouter } from "@/trpc/routers/_app";
import { ROUTE } from "@/app/constant/route";
import { formatDate } from "@/app/component/reports-table/reports-table-utils/reports-table.utils";
import { formatOrganizationLabel } from "@/utils/organization-label";

export type ContactRow =
  inferRouterOutputs<AppRouter>["crm"]["getContacts"]["items"][number];

export function getContactsColumns(): ColumnDef<ContactRow>[] {
  return [
    {
      id: "name",
      header: "Nom",
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      meta: { sortType: "alpha" },
      enableSorting: true,
    },
    {
      id: "email",
      header: "Adresse e-mail",
      accessorFn: (row) => row.email,
      meta: { sortType: "alpha" },
      enableSorting: true,
    },
    {
      id: "area",
      header: "Territoire",
      cell: ({ row }) => row.original.area?.name ?? "-",
      enableSorting: false,
    },
    {
      id: "organization",
      header: "Organisme",
      cell: ({ row }) => {
        const organization = row.original.organization;
        return organization ? formatOrganizationLabel(organization) : "-";
      },
      enableSorting: false,
    },
    {
      id: "createdAt",
      header: "Date de création",
      cell: ({ row }) => formatDate(row.original.createdAt),
      meta: { sortType: "date" },
      enableSorting: true,
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <Link href={`${ROUTE.CONTACTS}/${row.original.id}`} className="fr-link">
          Voir la fiche
        </Link>
      ),
      enableSorting: false,
    },
  ];
}
