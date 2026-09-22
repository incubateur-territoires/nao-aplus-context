import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { StatsChart } from "@/app/(public)/statistiques/components/stats-chart/stats-chart";

/**
 * Évolution mensuelle des signalements analysés (date de DÉPÔT, pas
 * d'analyse). Reçoit les items déjà filtrés par tags : sélectionner « carsat »
 * + « absence de réponse » trace l'historique de cette paire — c'est là que
 * les émergences se voient.
 */

interface TimelineItem {
  createdAt?: string;
}

interface TagTimelineProps {
  items: TimelineItem[];
  /** Vrai quand des filtres par tag sont actifs (précisé dans le titre). */
  isFiltered: boolean;
}

export interface TimelineData {
  labels: string[];
  values: number[];
  /** Items sans date de dépôt (analysés avant la capture du `createdAt`). */
  undated: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildTimeline(items: TimelineItem[]): TimelineData {
  const counts = new Map<string, number>();
  let undated = 0;

  for (const item of items) {
    const date = item.createdAt ? new Date(item.createdAt) : null;
    if (!date || Number.isNaN(date.getTime())) {
      undated++;
      continue;
    }
    const key = monthKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (counts.size === 0) return { labels: [], values: [], undated };

  // Axe continu du premier au dernier mois : les mois à zéro restent visibles,
  // sinon les creux disparaissent et la courbe ment.
  const keys = [...counts.keys()].sort();
  const [firstYear, firstMonth] = keys[0].split("-").map(Number);
  const [lastYear, lastMonth] = keys[keys.length - 1].split("-").map(Number);

  const labels: string[] = [];
  const values: number[] = [];
  const cursor = new Date(firstYear, firstMonth - 1, 1);
  const end = new Date(lastYear, lastMonth - 1, 1);
  while (cursor <= end) {
    labels.push(format(cursor, "MMM yyyy", { locale: fr }));
    values.push(counts.get(monthKey(cursor)) ?? 0);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return { labels, values, undated };
}

export function TagTimeline({ items, isFiltered }: TagTimelineProps) {
  const timeline = buildTimeline(items);
  if (timeline.labels.length === 0) return null;

  return (
    <section>
      <h2 className="fr-h5">
        Évolution mensuelle{isFiltered ? " (résultats filtrés)" : ""}
      </h2>
      <StatsChart
        type="bar"
        labels={timeline.labels}
        values={timeline.values}
        seriesName="Signalements déposés"
        unit="signalements"
      />
      {timeline.undated > 0 && (
        <p className="m-0 text-sm text-[#666]">
          {timeline.undated} signalement{timeline.undated > 1 ? "s" : ""} sans
          date (analysé{timeline.undated > 1 ? "s" : ""} avant la capture de la
          date de dépôt).
        </p>
      )}
    </section>
  );
}
