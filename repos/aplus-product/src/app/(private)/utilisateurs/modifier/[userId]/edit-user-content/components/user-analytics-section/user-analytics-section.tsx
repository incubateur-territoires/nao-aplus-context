"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Tag } from "@codegouvfr/react-dsfr/Tag";
import { useTRPC } from "@/trpc/client";
import { DataTable } from "@/app/component/data-table/data-table";
import { Pagination } from "@/app/component/pagination/pagination";
import { formatToLongDate } from "@/utils/format";
import {
  EVENT_CATEGORY_LABELS,
  formatAnalyticsEventDescription,
  getEventCategoryLabel,
} from "@/utils/format-analytics-event";
import type { EventCategory } from "@/types/analytics";
import {
  getUserAnalyticsColumns,
  type UserAnalyticsRow,
} from "./user-analytics-columns/user-analytics-columns";
import { UserActivitySummary } from "./user-activity-summary/user-activity-summary";

const ITEMS_PER_PAGE = 10;
const TIME_ZONE = "Europe/Paris";

// Au-delà, les boutons « Première / Dernière page » font déborder la
// pagination (même logique que la liste des utilisateurs).
const SHOW_FIRST_LAST_MAX_PAGES = 100;

// Catégories dans l'ordre d'affichage des filtres. « Navigation » (page_view)
// en dernier : très volumineux, masqué tant qu'on ne le sélectionne pas.
const CATEGORY_ORDER: EventCategory[] = [
  "auth",
  "report",
  "answer",
  "file",
  "user",
  "team",
  "search",
  "page_view",
];

interface UserAnalyticsSectionProps {
  userId: string;
}

export function UserAnalyticsSection({ userId }: UserAnalyticsSectionProps) {
  const trpc = useTRPC();
  const [page, setPage] = useState(1);
  // "" = toutes les catégories (hors Navigation). Sélectionner « Navigation »
  // est le seul cas qui inclut les page_view.
  const [category, setCategory] = useState("");

  const { data, isLoading } = useQuery({
    ...trpc.analytics.getUserEvents.queryOptions({
      userId,
      page,
      pageSize: ITEMS_PER_PAGE,
      category: category ? (category as EventCategory) : undefined,
      includePageViews: category === "page_view",
    }),
    placeholderData: keepPreviousData,
  });

  const { data: counts } = useQuery(
    trpc.analytics.getUserEventCounts.queryOptions({ userId }),
  );

  // « Tout » = tous les événements sauf les pages consultées (bruit).
  const totalExcludingPageViews = useMemo(() => {
    if (!counts) return null;
    return Object.entries(counts).reduce(
      (sum, [cat, count]) => (cat === "page_view" ? sum : sum + count),
      0,
    );
  }, [counts]);

  const rows: UserAnalyticsRow[] = useMemo(
    () =>
      data?.items.map((event) => ({
        id: event.id,
        date: formatToLongDate(event.occurredAt ?? event.createdAt, TIME_ZONE),
        description: formatAnalyticsEventDescription({
          eventName: event.eventName,
          metadata: event.metadata,
          actorName: event.actorName,
          targetName: event.targetName,
        }),
        isTarget: event.isTarget,
        categoryLabel: getEventCategoryLabel(event.eventCategory),
        pagePath: event.pagePath,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata,
      })) ?? [],
    [data],
  );

  const columns = useMemo(() => getUserAnalyticsColumns(), []);
  const totalPages = data?.totalPages ?? 0;

  function selectCategory(next: string) {
    setCategory(next);
    setPage(1);
  }

  function renderCount(count: number | null): string {
    return count === null ? "" : ` ${count}`;
  }

  return (
    <section className="flex flex-col">
      <h2>Activité de l&apos;utilisateur</h2>

      <UserActivitySummary userId={userId} timeZone={TIME_ZONE} />

      <p className="text-[#666]">
        Historique des événements enregistrés pour cet utilisateur (vue
        support). Les lignes marquées «&nbsp;Cible&nbsp;» sont des actions
        subies par l&apos;utilisateur, effectuées par quelqu&apos;un
        d&apos;autre.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm">Filtrer :</span>
        <Tag
          pressed={category === ""}
          nativeButtonProps={{
            onClick: (e) => {
              e.preventDefault();
              selectCategory("");
            },
          }}
        >
          Tout
          {renderCount(totalExcludingPageViews)}
        </Tag>
        {CATEGORY_ORDER.map((cat) => {
          const count = counts?.[cat] ?? null;
          return (
            <Tag
              key={cat}
              pressed={category === cat}
              nativeButtonProps={{
                disabled: count === 0,
                onClick: (e) => {
                  e.preventDefault();
                  selectCategory(cat);
                },
              }}
            >
              {EVENT_CATEGORY_LABELS[cat]}
              {renderCount(count)}
            </Tag>
          );
        })}
      </div>

      {isLoading ? (
        <div role="status">Chargement...</div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            enableSorting={false}
            emptyMessage="Aucune activité enregistrée pour cet utilisateur."
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
        </>
      )}
    </section>
  );
}
