"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Dialog } from "@mui/material";
import { useTRPC } from "@/trpc/client";
import { useDebounce } from "@/app/hooks/use-debounce";
import { useRecentQuickSearch } from "@/app/hooks/use-recent-quick-search";
import { QUICK_SEARCH_PAGES } from "@/app/constant/quick-search";
import { ReportStatusBadge } from "@/app/component/request-status-badge/request-status-badge";
import { QUICK_SEARCH_KINDS, type QuickSearchItem } from "@/types/quick-search";
import {
  filterQuickSearchPages,
  toQuickSearchItems,
} from "@/utils/quick-search";

const MIN_QUERY_LENGTH = 2;

export function CommandPalette() {
  const trpc = useTRPC();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 250);
  const [selectedValue, setSelectedValue] = useState("");
  const { recents, addRecent } = useRecentQuickSearch();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasQuery = query.trim().length > 0;
  const searchEnabled =
    open && hasQuery && debouncedQuery.length >= MIN_QUERY_LENGTH;
  const { data, isFetching } = useQuery(
    trpc.quickSearch.search.queryOptions(
      { query: debouncedQuery },
      { enabled: searchEnabled, placeholderData: (previous) => previous },
    ),
  );

  const results = searchEnabled && data ? toQuickSearchItems(data) : null;
  const pages = hasQuery
    ? filterQuickSearchPages(QUICK_SEARCH_PAGES, query)
    : QUICK_SEARCH_PAGES;
  const groups: ItemGroupProps[] = [
    { heading: "Récents", items: hasQuery ? [] : recents },
    { heading: "Signalements", items: results?.reports ?? [] },
    { heading: "Utilisateurs", items: results?.users ?? [] },
    { heading: "Équipes", items: results?.teams ?? [] },
    { heading: "Pages", items: pages },
  ].filter((group) => group.items.length > 0);

  // Les résultats arrivent après la frappe : sans sélection contrôlée, cmdk
  // perd la ligne active et Entrée ne fait plus rien.
  const values = groups.flatMap((group) =>
    group.items.map((item) => itemValue(group.heading, item)),
  );
  const activeValue = values.includes(selectedValue)
    ? selectedValue
    : (values[0] ?? "");

  function close() {
    setOpen(false);
  }

  function select(item: QuickSearchItem) {
    // Le statut d'un signalement change : on ne le fige pas dans les récents.
    if (item.kind !== QUICK_SEARCH_KINDS.PAGE) {
      addRecent({ ...item, status: undefined });
    }
    close();
    router.push(item.href);
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      aria-label="Recherche rapide"
      PaperProps={{ sx: { alignSelf: "flex-start", mt: "12vh" } }}
      // Vider la saisie une fois la modale disparue, pas pendant son fondu.
      TransitionProps={{ onExited: () => setQuery("") }}
    >
      <Command
        shouldFilter={false}
        label="Recherche rapide"
        loop
        value={activeValue}
        onValueChange={setSelectedValue}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-default-grey)] px-4">
          <span className="ri-search-line" aria-hidden="true" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Signalement, utilisateur, équipe, page… ou un identifiant"
            className="w-full bg-transparent py-4 text-base outline-none"
            autoFocus
          />
          {isFetching ? (
            <span className="fr-text--xs fr-mb-0 whitespace-nowrap text-[var(--text-mention-grey)]">
              Recherche…
            </span>
          ) : null}
        </div>
        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          {groups.length === 0 && !isFetching ? (
            <Command.Empty className="p-4 text-center text-[var(--text-mention-grey)]">
              Aucun résultat
            </Command.Empty>
          ) : null}
          {groups.map((group) => (
            <ItemGroup
              key={group.heading}
              heading={group.heading}
              items={group.items}
              onSelect={select}
            />
          ))}
        </Command.List>
        <div className="fr-text--xs fr-mb-0 flex gap-4 border-t border-[var(--border-default-grey)] px-4 py-2 text-[var(--text-mention-grey)]">
          <span>↑↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>Échap fermer</span>
        </div>
      </Command>
    </Dialog>
  );
}

interface ItemGroupProps {
  heading: string;
  items: QuickSearchItem[];
}

function itemValue(heading: string, item: QuickSearchItem) {
  return `${heading}-${item.kind}-${item.id}`;
}

function ItemGroup({
  heading,
  items,
  onSelect,
}: ItemGroupProps & { onSelect: (item: QuickSearchItem) => void }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-[var(--text-mention-grey)]"
    >
      {items.map((item) => (
        <Command.Item
          key={itemValue(heading, item)}
          value={itemValue(heading, item)}
          onSelect={() => onSelect(item)}
          className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-2 data-[selected=true]:bg-[var(--background-alt-blue-france)]"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{item.label}</span>
            {item.detail ? (
              <span className="truncate text-xs text-[var(--text-mention-grey)]">
                {item.detail}
              </span>
            ) : null}
          </span>
          {item.status ? (
            <ReportStatusBadge status={item.status} small />
          ) : null}
        </Command.Item>
      ))}
    </Command.Group>
  );
}
