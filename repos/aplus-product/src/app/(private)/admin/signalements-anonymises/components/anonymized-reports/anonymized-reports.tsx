"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { AnonymizedReportSearch } from "@/utils/anonymized-report";
import type { AnonymizedReportOperator } from "@/types/anonymized-report";
import { AnonymizedReportFilters } from "../anonymized-report-filters/anonymized-report-filters";
import { AnonymizedReportList } from "../anonymized-report-list/anonymized-report-list";
import { AnonymizedReportDetail } from "../anonymized-report-detail/anonymized-report-detail";

interface AnonymizedReportsProps {
  search: AnonymizedReportSearch;
  operators: AnonymizedReportOperator[];
}

export function AnonymizedReports({
  search,
  operators,
}: AnonymizedReportsProps) {
  const trpc = useTRPC();
  const { id, ...listInput } = search;
  const { data: page, error } = useQuery(
    trpc.anonymizedReport.list.queryOptions(listInput),
  );
  const selectedId = id ?? page?.items[0]?.id;

  return (
    <>
      <AnonymizedReportFilters search={search} operators={operators} />
      <div className="grid gap-6 items-start md:grid-cols-[420px_1fr] pb-12">
        <section className="bg-white" aria-label="Liste des signalements">
          {error ? (
            <p className="p-4 mb-0!">{error.message}</p>
          ) : page ? (
            <AnonymizedReportList
              page={page}
              search={search}
              selectedId={selectedId}
            />
          ) : (
            <p className="p-4 mb-0!">Chargement des signalements…</p>
          )}
        </section>
        {selectedId && (
          <section
            className="bg-white p-8"
            aria-label="Signalement sélectionné"
          >
            <AnonymizedReportDetail id={selectedId} />
          </section>
        )}
      </div>
    </>
  );
}
