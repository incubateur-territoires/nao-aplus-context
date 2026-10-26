import type { TaggingAxisStats, TaggingStats } from "@/types/tagging-stats";
import { formatPercentage } from "@/utils/stats-percentage";

interface TaggingKpisProps {
  stats: TaggingStats;
}

const numberFormatter = new Intl.NumberFormat("fr-FR");

function approvalOf({ upvotes, downvotes }: TaggingAxisStats) {
  return upvotes + downvotes === 0
    ? "–"
    : formatPercentage(upvotes, upvotes + downvotes);
}

export function TaggingKpis({ stats }: TaggingKpisProps) {
  const kpis = [
    {
      label: "Signalements étiquetés",
      value: numberFormatter.format(stats.taggedReports),
    },
    { label: "Votants", value: numberFormatter.format(stats.voters) },
    { label: "Votes", value: numberFormatter.format(stats.votes) },
    {
      label: "Approbation de la démarche",
      value: approvalOf(stats.axes.procedure),
    },
    {
      label: "Approbation du blocage",
      value: approvalOf(stats.axes.blockage),
    },
    {
      label: "Utilisateurs ayant masqué le bloc de vote",
      value: numberFormatter.format(stats.hiddenFeedbackUsers),
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 mb-8">
      {kpis.map(({ label, value }) => (
        <div key={label} className="flex flex-col-reverse bg-white p-4">
          <dt className="fr-text--sm mb-0 text-(--text-mention-grey)">
            {label}
          </dt>
          <dd className="fr-h3 mb-1">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
