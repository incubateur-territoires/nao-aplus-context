"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { FRENCH_TIMEZONES } from "@/types/timezone";
import { ANSWER_SIDE_LABEL } from "@/utils/anonymized-report";
import { formatToLongDate } from "@/utils/format";
import { AnonymizedReportTags } from "../anonymized-report-tags/anonymized-report-tags";

interface AnonymizedReportDetailProps {
  id: string;
}

function displayDate(date: Date): string {
  return formatToLongDate(date, FRENCH_TIMEZONES.EUROPE_PARIS);
}

export function AnonymizedReportDetail({ id }: AnonymizedReportDetailProps) {
  const trpc = useTRPC();
  const { data: report, error } = useQuery(
    trpc.anonymizedReport.getById.queryOptions({ id }),
  );

  if (error) {
    return <p className="mb-0!">{error.message}</p>;
  }

  if (!report) {
    return <p className="mb-0!">Chargement du signalement…</p>;
  }

  return (
    <article>
      <p className="fr-text--xs mb-1! text-[var(--text-mention-grey)]">
        Créé le {displayDate(report.createdAt)}
      </p>
      <h2 className="fr-h4 mb-2!">{report.subject}</h2>
      {report.requestedTeams.length > 0 && (
        <p className="fr-text--sm mb-4! text-[var(--text-mention-grey)]">
          Équipes destinataires : {report.requestedTeams.join(", ")}
        </p>
      )}
      <AnonymizedReportTags
        procedureLabel={report.procedureLabel}
        blockageLabel={report.blockageLabel}
        className="mb-8!"
      />

      <h3 className="fr-h6">Description</h3>
      <p className="whitespace-pre-line leading-[1.8] mb-8!">
        {report.description}
      </p>

      <h3 className="fr-h6" id="anonymized-report-answers">
        Échanges
      </h3>
      {report.answers.length === 0 ? (
        <p className="mb-0!">Aucun échange.</p>
      ) : (
        <ul
          className="list-none! p-0! m-0!"
          aria-labelledby="anonymized-report-answers"
        >
          {report.answers.map((answer) => (
            <li
              key={answer.id}
              className="border-l-[3px] border-[var(--border-default-grey)] pl-4 mb-5 p-0!"
            >
              <p className="text-xs text-[var(--text-mention-grey)] mb-1!">
                {answer.operator ?? ANSWER_SIDE_LABEL[answer.side]} ·{" "}
                {displayDate(answer.createdAt)}
              </p>
              <p className="whitespace-pre-line leading-[1.8] mb-0!">
                {answer.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
