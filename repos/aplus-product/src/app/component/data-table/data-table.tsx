"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import { Pagination } from "@/app/component/pagination/pagination";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type SortingFn,
  type ColumnFiltersState,
  type VisibilityState,
  type RowData,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

type SortType = "alpha" | "status" | "date" | "role" | "numeric";

// Caractères invisibles (largeur nulle, BOM, espace insécable, marques de
// direction) qui peuvent se glisser en tête d'une valeur importée : sans
// nettoyage ils se trient AVANT les lettres et remontent des lignes en tête de
// liste par erreur (ex. un nom d'équipe précédé d'un caractère masqué).
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\u00A0\uFEFF]/g;

function normalizeForAlphaSort(value: unknown): string {
  return String(value ?? "")
    .replace(INVISIBLE_CHARS, "")
    .trim();
}

// Tri alphabétique respectant la locale française (accents, casse) avec ordre
// numérique naturel (« Équipe 2 » avant « Équipe 10 »). `sensitivity: "base"`
// pour que la casse et les accents ne créent pas d'écarts de tri surprenants.
const alphaCollator = new Intl.Collator("fr", {
  sensitivity: "base",
  numeric: true,
});

// Remplace le tri texte par défaut de tanstack (comparaison brute code-point,
// sans locale ni gestion des caractères invisibles) pour les colonnes
// `sortType: "alpha"`.
const alphaSortingFn: SortingFn<RowData> = (rowA, rowB, columnId) =>
  alphaCollator.compare(
    normalizeForAlphaSort(rowA.getValue(columnId)),
    normalizeForAlphaSort(rowB.getValue(columnId)),
  );

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    cellClassName?: string;
    sortType?: SortType;
  }
}

const SORT_TITLES: Record<SortType, { asc: string; desc: string }> = {
  alpha: {
    asc: "Trier par ordre alphabétique",
    desc: "Trier par ordre alphabétique inversé",
  },
  status: {
    asc: "Trier par ordre de traitement",
    desc: "Trier par ordre de traitement inversé",
  },
  date: {
    asc: "Trier par ordre chronologique",
    desc: "Trier par ordre chronologique inversé",
  },
  role: {
    asc: "Trier par rôle",
    desc: "Trier par rôle inversé",
  },
  numeric: {
    asc: "Trier par ordre croissant",
    desc: "Trier par ordre décroissant",
  },
};

function getSortTitle(
  sortType: SortType | undefined,
  isSortedAsc: boolean,
): string {
  if (!sortType) {
    return isSortedAsc
      ? "Trier par ordre décroissant"
      : "Trier par ordre croissant";
  }
  const titles = SORT_TITLES[sortType];
  return isSortedAsc ? titles.desc : titles.asc;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  enableSorting?: boolean;
  enableFiltering?: boolean;
  defaultSorting?: SortingState;
  manualSorting?: boolean;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  emptyMessage?: string;
  pageSize?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  enableSorting = true,
  enableFiltering = true,
  defaultSorting = [],
  manualSorting = false,
  sorting: controlledSorting,
  onSortingChange,
  emptyMessage = "Aucun signalement trouvé",
  pageSize,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] =
    useState<SortingState>(defaultSorting);
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = onSortingChange ?? setInternalSorting;
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const enablePagination = pageSize !== undefined;

  // Attache le tri alphabétique locale-aware aux colonnes `sortType: "alpha"`
  // qui ne définissent pas déjà leur propre `sortingFn`. Sans cela, tanstack
  // retombe sur son tri texte brut (code-point), qui ignore la locale française
  // et les caractères invisibles en tête de valeur.
  const resolvedColumns = useMemo(
    () =>
      columns.map((column) =>
        column.meta?.sortType === "alpha" && !column.sortingFn
          ? { ...column, sortingFn: alphaSortingFn as SortingFn<TData> }
          : column,
      ),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: resolvedColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel:
      enableSorting && !manualSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
      if (enablePagination) setPageIndex(0);
    },
    onColumnFiltersChange: (updater) => {
      setColumnFilters(updater);
      if (enablePagination) setPageIndex(0);
    },
    onColumnVisibilityChange: setColumnVisibility,
    enableSortingRemoval: false,
    manualSorting,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      ...(enablePagination ? { pagination: { pageIndex, pageSize } } : {}),
    },
  });

  const pageCount = enablePagination ? table.getPageCount() : 0;

  return (
    <div className="w-full">
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse border border-[#929292]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-[#F6F6F6]">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className={`px-4 py-3 text-left text-sm font-semibold text-[#3A3A3A] border border-[#929292] ${header.column.columnDef.meta?.cellClassName ?? ""}`}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {enableSorting && header.column.getCanSort() && (
                          <Button
                            iconId={
                              header.column.getIsSorted() === "asc"
                                ? "ri-arrow-down-line"
                                : header.column.getIsSorted() === "desc"
                                  ? "ri-arrow-up-line"
                                  : "ri-arrow-up-down-line"
                            }
                            className="ml-2"
                            priority="tertiary"
                            size="small"
                            onClick={header.column.getToggleSortingHandler()}
                            title={getSortTitle(
                              header.column.columnDef.meta?.sortType,
                              header.column.getIsSorted() === "asc",
                            )}
                          />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-[#fafafa] border border-[#929292]"
                  style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "0 53px",
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-4 py-3 text-sm align-middle ${cell.column.columnDef.meta?.cellClassName ?? ""}`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-600"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {enablePagination && pageCount > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={pageCount}
            defaultPage={pageIndex + 1}
            getPageLinkProps={(pageNumber) => ({
              href: "#",
              "aria-label": `Page ${pageNumber}`,
              onClick: (e: React.MouseEvent) => {
                e.preventDefault();
                setPageIndex(pageNumber - 1);
              },
            })}
            showFirstLast
          />
        </div>
      )}
    </div>
  );
}
