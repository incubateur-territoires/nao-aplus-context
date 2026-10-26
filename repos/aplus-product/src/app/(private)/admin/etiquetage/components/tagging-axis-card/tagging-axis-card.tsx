import Badge from "@codegouvfr/react-dsfr/Badge";
import Table from "@codegouvfr/react-dsfr/Table";
import { StatsChart } from "@/app/(public)/statistiques/components/stats-chart/stats-chart";
import type { TaggingAxisStats } from "@/types/tagging-stats";
import { formatPercentage } from "@/utils/stats-percentage";
import {
  chartLabelOf,
  needsReview,
  NO_DISPLAYED_LABEL,
} from "@/utils/tagging-stats";

const CHART_TOP_LABELS = 10;

interface TaggingAxisCardProps {
  title: string;
  stats: TaggingAxisStats;
}

const numberFormatter = new Intl.NumberFormat("fr-FR");

interface VoteHeaderProps {
  icon: string;
  label: string;
}

function VoteHeader({ icon, label }: VoteHeaderProps) {
  return (
    <span className="whitespace-nowrap">
      <span className={`${icon} fr-icon--sm mr-1`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function TaggingAxisCard({ title, stats }: TaggingAxisCardProps) {
  // « Sans libellé affiché » regroupe jusqu'à la quasi-totalité des
  // signalements sur l'axe blocage : dans le graphique, il écraserait l'échelle
  // de tous les vrais libellés. Il reste dans le tableau.
  const charted = stats.labels
    .filter((label) => label.reports > 0 && label.label !== NO_DISPLAYED_LABEL)
    .slice(0, CHART_TOP_LABELS);

  return (
    <section className="flex flex-col gap-6 bg-white p-6 md:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="fr-h4 mb-0">{title}</h2>
        <p className="fr-text--sm mb-0 text-(--text-mention-grey)">
          Les {CHART_TOP_LABELS} libellés les plus attribués, sur le dernier
          étiquetage de chaque signalement. Les signalements sans libellé
          affiché ne figurent que dans le tableau.
        </p>
      </div>
      <div className="min-h-[300px] min-w-0">
        <StatsChart
          type="bar"
          labels={charted.map(({ label }) => chartLabelOf(label))}
          values={charted.map(({ reports }) => reports)}
          seriesName="Signalements"
          unit="signalements"
        />
      </div>
      <Table
        noCaption
        caption={`Votes par libellé : ${title}`}
        headers={[
          "Libellé",
          "Signalements",
          <VoteHeader key="up" icon="fr-icon-thumb-up-fill" label="Correct" />,
          <VoteHeader
            key="down"
            icon="fr-icon-thumb-down-fill"
            label="Incorrect"
          />,
          "Taux d'approbation",
        ]}
        data={stats.labels.map((label) => [
          <span key="label" className="flex flex-wrap items-center gap-2">
            {label.label}
            {needsReview(label) && (
              <Badge severity="warning" small>
                À revoir
              </Badge>
            )}
          </span>,
          numberFormatter.format(label.reports),
          numberFormatter.format(label.upvotes),
          numberFormatter.format(label.downvotes),
          label.approvalRate === null
            ? "–"
            : formatPercentage(label.upvotes, label.upvotes + label.downvotes),
        ])}
      />
    </section>
  );
}
