import type { TaggingStats } from "@/types/tagging-stats";
import { TAGGING_AXES, type TaggingAxis } from "@/utils/tagging-feedback";
import { TaggingAxisCard } from "../tagging-axis-card/tagging-axis-card";
import { TaggingKpis } from "../tagging-kpis/tagging-kpis";
import { TaggingVotesChart } from "../tagging-votes-chart/tagging-votes-chart";

const AXIS_TITLE: Record<TaggingAxis, string> = {
  procedure: "Démarche du citoyen",
  blockage: "Blocage rencontré",
};

interface TaggingDashboardProps {
  stats: TaggingStats;
}

export function TaggingDashboard({ stats }: TaggingDashboardProps) {
  if (stats.taggedReports === 0) {
    return (
      <p className="bg-white p-6" role="status">
        Aucun signalement n&apos;a encore été étiqueté par l&apos;IA.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <TaggingKpis stats={stats} />
      <div className="grid gap-8 lg:grid-cols-2 items-start">
        {Object.values(TAGGING_AXES).map((axis) => (
          <TaggingAxisCard
            key={axis}
            title={AXIS_TITLE[axis]}
            stats={stats.axes[axis]}
          />
        ))}
      </div>
      <TaggingVotesChart votesByWeek={stats.votesByWeek} />
    </div>
  );
}
