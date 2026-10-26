import { StatsChart } from "@/app/(public)/statistiques/components/stats-chart/stats-chart";
import type { WeeklyVotes } from "@/types/tagging-stats";
import { formatDate } from "@/utils/format";

interface TaggingVotesChartProps {
  votesByWeek: WeeklyVotes[];
}

export function TaggingVotesChart({ votesByWeek }: TaggingVotesChartProps) {
  return (
    <section className="flex flex-col gap-6 bg-white p-6 md:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="fr-h4 mb-0">Votes par semaine</h2>
        <p className="fr-text--sm mb-0 text-(--text-mention-grey)">
          Votes « correct » et « incorrect » confondus, par semaine du premier
          vote de chaque personne sur un étiquetage.
        </p>
      </div>
      <div className="min-h-[300px] min-w-0">
        <StatsChart
          type="bar"
          labels={votesByWeek.map(
            ({ weekStart }) =>
              `Sem. du ${formatDate(weekStart, "UTC", { day: "numeric", month: "short" })}`,
          )}
          values={votesByWeek.map(
            ({ upvotes, downvotes }) => upvotes + downvotes,
          )}
          seriesName="Votes"
          unit="votes"
        />
      </div>
    </section>
  );
}
