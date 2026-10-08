import Link from "next/link";
import { Pagination } from "@/app/component/pagination/pagination";
import { FRENCH_TIMEZONES } from "@/types/timezone";
import type { AnonymizedReportPage } from "@/types/anonymized-report";
import {
  anonymizedReportsHref,
  type AnonymizedReportSearch,
} from "@/utils/anonymized-report";
import { formatDate } from "@/utils/format";
import { AnonymizedReportTags } from "../anonymized-report-tags/anonymized-report-tags";

interface AnonymizedReportListProps {
  page: AnonymizedReportPage;
  search: AnonymizedReportSearch;
  selectedId: string | undefined;
}

export function AnonymizedReportList({
  page,
  search,
  selectedId,
}: AnonymizedReportListProps) {
  const pageCount = Math.ceil(page.total / page.pageSize);

  return (
    <>
      <p className="fr-text--sm mb-0! px-4 py-2 border-b border-[var(--border-default-grey)]">
        <strong>{page.total.toLocaleString("fr-FR")}</strong>{" "}
        {page.total > 1 ? "signalements" : "signalement"}
      </p>
      {page.items.length === 0 ? (
        <p className="p-4 mb-0!">Aucun signalement anonymisé ne correspond.</p>
      ) : (
        <ul className="list-none! p-0! m-0!">
          {page.items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <li key={item.id} className="p-0!">
                <Link
                  href={anonymizedReportsHref({ ...search, id: item.id })}
                  aria-current={selected ? "true" : undefined}
                  className={`block bg-none! px-4 py-3 border-b border-[var(--border-default-grey)] hover:bg-[var(--background-alt-grey)]! ${
                    selected
                      ? "bg-[var(--background-action-low-blue-france)]! shadow-[inset_4px_0_0_var(--border-action-high-blue-france)]"
                      : ""
                  }`}
                >
                  <span className="block font-bold text-[0.95rem] mb-2">
                    {item.subject}
                  </span>
                  <AnonymizedReportTags
                    procedureLabel={item.procedureLabel}
                    blockageLabel={item.blockageLabel}
                    small
                    className="mb-0!"
                  />
                  <span className="block text-xs text-[var(--text-mention-grey)] mt-1">
                    {formatDate(item.createdAt, FRENCH_TIMEZONES.EUROPE_PARIS)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {pageCount > 1 && (
        <Pagination
          className="p-4"
          count={pageCount}
          defaultPage={Math.min(search.page, pageCount)}
          getPageLinkProps={(pageNumber) => ({
            href: anonymizedReportsHref({
              page: pageNumber,
              operator: search.operator,
              includeUntagged: search.includeUntagged,
              procedureLabel: search.procedureLabel,
              blockageLabel: search.blockageLabel,
            }),
          })}
        />
      )}
    </>
  );
}
