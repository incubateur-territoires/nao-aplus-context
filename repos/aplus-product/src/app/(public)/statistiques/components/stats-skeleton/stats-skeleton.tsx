// Nombre de cartes affichées par le tableau de bord : le squelette en reproduit
// autant pour que la hauteur de la page ne saute pas à l'arrivée des données.
const CARD_COUNT = 7;

const LEGEND_ITEM_WIDTHS = ["w-24", "w-32", "w-20", "w-28"];

interface StatsSkeletonProps {
  /** Nombre de cartes fantômes (par défaut, autant que le tableau de bord). */
  count?: number;
}

/**
 * Squelette de chargement du tableau de bord des statistiques : une carte
 * fantôme par graphique (titre, zone de graphique, légende, barre d'actions).
 * Affiché au premier chargement et pendant le recalcul lié à un changement de
 * filtres, à la place des graphiques.
 */
export function StatsSkeleton({ count = CARD_COUNT }: StatsSkeletonProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
      {/* Le squelette est purement décoratif (aria-hidden) : l'état de
          chargement est annoncé une seule fois aux lecteurs d'écran. */}
      <p role="status" className="fr-sr-only lg:col-span-2">
        Chargement des statistiques…
      </p>

      {Array.from({ length: count }, (_, index) => (
        <section
          key={index}
          aria-hidden="true"
          className="flex flex-col gap-8 bg-white p-6 motion-safe:animate-pulse md:p-8"
        >
          <div className="h-7 w-2/3 max-w-md rounded bg-[#eeeeee]" />

          <div className="flex flex-col gap-6">
            <div className="h-[300px] rounded bg-[#eeeeee]" />
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {LEGEND_ITEM_WIDTHS.map((width) => (
                <div key={width} className="flex items-center gap-2">
                  <span className="size-3 shrink-0 rounded-[2px] bg-[#dddddd]" />
                  <span className={`h-4 rounded bg-[#eeeeee] ${width}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="h-8 w-48 rounded bg-[#eeeeee]" />
            <div className="h-8 w-52 rounded bg-[#eeeeee]" />
          </div>
        </section>
      ))}
    </div>
  );
}
