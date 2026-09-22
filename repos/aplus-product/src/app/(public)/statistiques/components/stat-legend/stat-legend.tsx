"use client";

import { useHydrated } from "@/app/hooks/use-hydrated";
import { getSeriesColor } from "@/utils/stats-chart-palette";

interface StatLegendProps {
  /** Libellés dans l'ordre des séries/tranches du graphique. */
  labels: string[];
}

/**
 * Légende maison d'un graphique de statistiques : carré de la couleur de la
 * série + libellé. La légende intégrée de dsfr-chart est masquée (CSS global,
 * `.stats-chart`) et remplacée par ce composant, affiché sous le graphique.
 */
export function StatLegend({ labels }: StatLegendProps) {
  // Avant hydratation, le serveur ne connaît pas le thème (`data-fr-theme` sur
  // <html>) : on rend la palette light puis on relit le thème après montage —
  // évite un mismatch d'hydratation en thème sombre.
  const isHydrated = useHydrated();
  const theme = isHydrated ? undefined : "light";

  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
      {labels.map((label, index) => (
        <li key={`${index}-${label}`} className="flex items-start gap-2 p-0">
          <span
            aria-hidden="true"
            className="mt-1 size-3 shrink-0 rounded-[2px]"
            style={{ backgroundColor: getSeriesColor(index, theme) }}
          />
          <span className="text-sm leading-5">{label}</span>
        </li>
      ))}
    </ul>
  );
}
