"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import { useTRPC } from "@/trpc/client";
import { DataTable } from "@/app/component/data-table/data-table";
import { Pagination } from "@/app/component/pagination/pagination";
import { useUrlTableState } from "@/app/hooks/use-url-table-state";
import { ROUTE } from "@/app/constant/route";
import { getContactsColumns } from "./contacts-columns/contacts-columns";

const ITEMS_PER_PAGE = 10;

// Au-delà de ce nombre de pages, les boutons « Première / Dernière page »
// (showFirstLast) font déborder la pagination sur une 2e ligne.
const SHOW_FIRST_LAST_MAX_PAGES = 100;

const SORT_KEYS = ["name", "email", "createdAt"] as const;
const DEFAULT_SORT = { id: "name", desc: false };

type ContactSortKey = (typeof SORT_KEYS)[number];

function toSortKey(id: string | undefined): ContactSortKey | undefined {
  return SORT_KEYS.find((key) => key === id);
}

export function ContactsContent() {
  // Filtres mémorisés dans l'URL : ils survivent à la navigation (consulter une
  // fiche puis revenir) et restent partageables.
  const {
    searchInput,
    setSearchInput,
    debouncedSearch,
    page,
    setPage,
    sorting,
    setSorting,
  } = useUrlTableState({
    prefix: "c_",
    defaultSort: DEFAULT_SORT,
    validSortKeys: SORT_KEYS,
  });
  const trpc = useTRPC();
  const trimmedSearch = debouncedSearch.trim();
  const currentSort = sorting[0];

  const { data: contactsData } = useQuery({
    ...trpc.crm.getContacts.queryOptions({
      page,
      pageSize: ITEMS_PER_PAGE,
      search: trimmedSearch || undefined,
      sortBy: toSortKey(currentSort?.id),
      sortOrder: currentSort ? (currentSort.desc ? "desc" : "asc") : undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo(() => getContactsColumns(), []);
  const contacts = contactsData?.items ?? [];
  const totalPages = contactsData?.totalPages ?? 0;

  return (
    <div className="p-4 md:p-20 bg-white relative">
      <div className="mb-8 flex flex-wrap gap-4 items-end justify-between">
        <Input
          addon={
            <span className="bg-blue-primary p-2 rounded-tr-[4px] text-white fr-icon-search-line -mt-px" />
          }
          className="w-full max-w-[480px]"
          id="search-contacts"
          label="Rechercher"
          hintText="Les résultats se mettent à jour automatiquement à la saisie."
          nativeLabelProps={{ className: "fr-h6 block mb-2" }}
          nativeInputProps={{
            placeholder: "Rechercher un nom, une adresse e-mail...",
            type: "text",
            value: searchInput,
            onChange: (e) => setSearchInput(e.target.value),
          }}
        />
        <Button
          priority="secondary"
          iconId="ri-user-add-line"
          linkProps={{ href: ROUTE.CREATE_CONTACT }}
        >
          Ajouter un contact
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={contacts}
        manualSorting
        sorting={sorting}
        onSortingChange={setSorting}
        emptyMessage="Aucun contact ne correspond à vos critères de recherche."
      />

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={totalPages}
            defaultPage={page}
            getPageLinkProps={(pageNumber) => ({
              href: "#",
              "aria-label": `Page ${pageNumber}`,
              onClick: (e) => {
                e.preventDefault();
                setPage(pageNumber);
              },
            })}
            showFirstLast={totalPages <= SHOW_FIRST_LAST_MAX_PAGES}
          />
        </div>
      )}
    </div>
  );
}
