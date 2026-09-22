"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { useTRPC } from "@/trpc/client";
import type { StatsFilters } from "@/trpc/routers/stats";
import { statsFiltersToSearchParams } from "@/utils/stats-filters-url";
import { useDebounce } from "@/app/hooks/use-debounce";
import { useMinimumDuration } from "@/app/hooks/use-minimum-duration";
import { FiltersIntroCard } from "../filters-intro-card/filters-intro-card";
import { StatsFiltersDrawer } from "../stats-filters-drawer/stats-filters-drawer";
import { StatCard } from "../stat-card/stat-card";
import { StatsSkeleton } from "../stats-skeleton/stats-skeleton";
import { CareDelaysTable } from "../care-delays-table/care-delays-table";

const EMPTY_OPTIONS = {
  areas: [],
  authorOrganizations: [],
  authorTeams: [],
  requestedOrganizations: [],
  requestedTeams: [],
};

// Les options de filtres changent rarement et la vue analytics n'est rafraîchie
// que toutes les 30 min : on garde les données « fraîches » 5 min pour éviter un
// refetch en arrière-plan inutile à chaque montage/navigation (les données sont
// déjà préchargées côté serveur).
const STATS_STALE_TIME = 5 * 60 * 1000;

// Auto-application des filtres : petite pause avant de rafraîchir les
// graphiques, pour ne pas déclencher une requête par clic pendant une
// sélection en rafale dans le tiroir.
const FILTERS_DEBOUNCE_MS = 400;

// Durée minimale d'affichage des indicateurs de chargement (squelettes des
// cartes, spinners des filtres) : la vue analytics répond souvent en quelques
// dizaines de millisecondes, si bien qu'ils clignotent et que la mise à jour
// passe inaperçue. On les maintient assez longtemps pour qu'elle se voie.
const LOADING_MIN_DURATION_MS = 1000;

// Définition partagée par les deux graphiques de prise en charge (délai en
// jours ouvrés et part en 72h ouvrées), alignée sur `hasTakenInCharge` de la vue.
const TAKEN_IN_CHARGE_DESCRIPTION =
  "Un signalement est pris en charge au premier geste de l'opérateur : passage en « En cours de traitement » ou directement en « Traité ». Les signalements fermés par l'aidant sans réponse ne sont pas comptés.";

// Le traitement (`hasCompleted` dans la vue) est une mesure d'impact distincte
// de la prise en charge : la phrase lève l'ambiguïté entre les deux graphiques.
const TREATMENT_DESCRIPTION =
  "Un signalement est traité quand il passe au statut « Traité ». C'est une mesure distincte de la prise en charge, qui est le premier geste de l'opérateur : un signalement pris en charge en un jour peut être traité dix jours plus tard. Les signalements fermés sans avoir été traités ne sont pas comptés.";

// Le graphique déplie les opérateurs de chaque signalement (`unnest` dans la
// requête) : son total est un nombre de sollicitations, pas de signalements.
const OPERATORS_DESCRIPTION =
  "Un signalement adressé à plusieurs opérateurs compte une fois pour chacun. Le total est un nombre de sollicitations, pas de signalements.";

interface StatistiquesContentProps {
  initialFilters?: StatsFilters;
}

export function StatistiquesContent({
  initialFilters = {},
}: StatistiquesContentProps) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const [filters, setFilters] = useState<StatsFilters>(initialFilters);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const debouncedFilters = useDebounce(filters, FILTERS_DEBOUNCE_MS);

  // Les options à facettes suivent les filtres SANS debounce : la liste des
  // équipes doit se restreindre dès qu'une organisation est choisie dans le
  // tiroir, pendant que les graphiques attendent la fin de la rafale.
  const { data: options, isFetching: isLoadingOptions } = useQuery(
    trpc.stats.getFilterOptions.queryOptions(filters, {
      staleTime: STATS_STALE_TIME,
      // Conserve les options affichées pendant le recalcul des facettes →
      // pas de listes qui clignotent vides le temps de la requête.
      placeholderData: keepPreviousData,
    }),
  );
  // Pas de `keepPreviousData` ici (contrairement aux options de filtres) : au
  // changement de filtres, les graphiques cèdent la place au squelette plutôt
  // que d'afficher des données périmées.
  const { data, isError: isDashboardError } = useQuery(
    trpc.stats.getDashboard.queryOptions(debouncedFilters, {
      staleTime: STATS_STALE_TIME,
    }),
  );
  const { data: careDelays, isError: isCareDelaysError } = useQuery(
    trpc.stats.getCareDelaysByTeam.queryOptions(debouncedFilters, {
      staleTime: STATS_STALE_TIME,
    }),
  );

  // Tant que le debounce n'a pas propagé le dernier changement, une mise à jour
  // est « en attente » : `filters` (nouvelle référence à chaque `setFilters`) et
  // `debouncedFilters` (ancienne référence maintenue par le hook) diffèrent. On
  // s'appuie sur ce signal pour montrer les indicateurs de chargement à CHAQUE
  // changement de filtre, même quand la combinaison cible est déjà en cache :
  // sans lui, un retrait de tag, une réinitialisation ou un effacement de la
  // période vers un état déjà chargé swapperait les données instantanément, sans
  // aucun retour visuel (`!data` reste faux). Combiné à `useMinimumDuration`,
  // l'indicateur reste visible assez longtemps pour être perçu.
  const isApplyingFilters = filters !== debouncedFilters;

  const isDashboardLoading = useMinimumDuration(
    isApplyingFilters || (!data && !isDashboardError),
    LOADING_MIN_DURATION_MS,
  );
  const isCareDelaysLoading = useMinimumDuration(
    isApplyingFilters || (!careDelays && !isCareDelaysError),
    LOADING_MIN_DURATION_MS,
  );
  const isRecalculatingOptions = useMinimumDuration(
    isApplyingFilters || isLoadingOptions,
    LOADING_MIN_DURATION_MS,
  );

  // Reflète les filtres appliqués dans l'URL (page partageable, cf. alerte
  // « Mémoire des filtres ») via l'API History native : les données sont déjà
  // récupérées côté client par `useQuery`, donc on évite de re-déclencher le
  // Server Component (et un fetch serveur redondant) que provoquerait
  // `router.replace`.
  useEffect(() => {
    const query = statsFiltersToSearchParams(debouncedFilters).toString();
    window.history.replaceState(
      null,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
  }, [debouncedFilters, pathname]);

  // Mémorise le déclencheur (bouton d'entête ou lien « Modifier les filtres »
  // d'un bloc vide) pour lui rendre le focus à la fermeture du tiroir.
  function openDrawer() {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setIsDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-10">
      <FiltersIntroCard onOpen={openDrawer} />

      <StatsFiltersDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        filters={filters}
        options={options ?? EMPTY_OPTIONS}
        onChange={setFilters}
        isLoadingOptions={isRecalculatingOptions}
        triggerRef={triggerRef}
      />

      {isDashboardError ? (
        // Sans ce cas, une requête en échec afficherait les blocs vides, ce qui
        // se lit comme « aucun signalement ne correspond aux filtres ».
        <Alert
          severity="error"
          title="Les statistiques n'ont pas pu être chargées"
          description="Une erreur est survenue. Réessayez plus tard ou modifiez vos filtres."
        />
      ) : isDashboardLoading || !data ? (
        <StatsSkeleton />
      ) : (
        // Masonry en deux colonnes AVEC ordre de lecture horizontal (1 en haut
        // à gauche, 2 en haut à droite, 3 dessous à gauche, etc.). Les colonnes
        // CSS (`columns-2`) donnent le masonry mais remplissent verticalement
        // (1-2-3-4 à gauche puis 5-6-7 à droite) ; une grille donne l'ordre
        // horizontal mais aligne les rangées et laisse un trou sous la carte la
        // plus courte. On combine les deux en répartissant nous-mêmes les
        // cartes : colonne de gauche = 1,3,5, colonne de droite = 2,4,6 puis 7
        // (« Pertinence », placée en bas à droite). Chaque colonne empile ses
        // cartes à leur hauteur naturelle → pas de trou.
        //
        // Sur mobile, la page tient sur une colonne : les deux conteneurs
        // passent en `display:contents` (leur boîte disparaît) et les sept
        // cartes redeviennent enfants directs de la grille à une colonne, où
        // `order-N` les remet dans l'ordre 1→7. À partir de `lg`, les
        // conteneurs redeviennent des colonnes flex (le `display:contents` est
        // écrasé par `lg:flex`) et `lg:order-0` neutralise l'ordre mobile.
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
            <div className="contents lg:flex lg:flex-col lg:gap-8">
              <div className="order-1 lg:order-0">
                <StatCard
                  id="nb-signalements"
                  title="Nombre de signalements"
                  chartType="bar"
                  labels={data.reportsByMonth.labels}
                  values={data.reportsByMonth.values}
                  seriesName="Nombre de signalements"
                  unit="signalements"
                  columnHeaders={{
                    label: "Date",
                    value: "Nombre de signalements",
                  }}
                  exportFileName="nombre-de-signalements"
                  onOpenFilters={openDrawer}
                />
              </div>
              <div className="order-3 lg:order-0">
                <StatCard
                  id="prise-en-charge-72h"
                  title="Signalements pris en charge en 72h ouvrées ou moins"
                  description={TAKEN_IN_CHARGE_DESCRIPTION}
                  chartType="share"
                  labels={data.takenInCharge72h.labels}
                  values={data.takenInCharge72h.values}
                  unit="signalements"
                  columnHeaders={{
                    label: "Délai de prise en charge",
                    value: "Nombre de signalements",
                  }}
                  exportFileName="prise-en-charge-72h"
                  onOpenFilters={openDrawer}
                />
              </div>
              <div className="order-5 lg:order-0">
                <StatCard
                  id="repartition-operateur"
                  title="Répartition des signalements par opérateur sollicité"
                  description={OPERATORS_DESCRIPTION}
                  chartType="pie"
                  labels={data.reportsByOperator.labels}
                  values={data.reportsByOperator.values}
                  unit="signalements"
                  columnHeaders={{
                    label: "Opérateur sollicité",
                    value: "Nombre de signalements",
                  }}
                  exportFileName="repartition-par-operateur"
                  onOpenFilters={openDrawer}
                />
              </div>
            </div>
            <div className="contents lg:flex lg:flex-col lg:gap-8">
              <div className="order-2 lg:order-0">
                <StatCard
                  id="delai-prise-en-charge"
                  title="Nombre de jours ouvrés entre la création et la prise en charge"
                  description={TAKEN_IN_CHARGE_DESCRIPTION}
                  chartType="pie"
                  labels={data.takenInChargeDelayDays.labels}
                  values={data.takenInChargeDelayDays.values}
                  unit="signalements"
                  columnHeaders={{
                    label: "Nombre de jours ouvrés",
                    value: "Nombre de signalements",
                  }}
                  exportFileName="jours-creation-prise-en-charge"
                  onOpenFilters={openDrawer}
                />
              </div>
              <div className="order-4 lg:order-0">
                <StatCard
                  id="repartition-etat"
                  title="Répartition des signalements par état"
                  chartType="pie"
                  labels={data.reportsByStatus.labels}
                  values={data.reportsByStatus.values}
                  unit="signalements"
                  columnHeaders={{
                    label: "État",
                    value: "Nombre de signalements",
                  }}
                  exportFileName="repartition-par-etat"
                  onOpenFilters={openDrawer}
                />
              </div>
              <div className="order-6 lg:order-0">
                <StatCard
                  id="delai-traitement"
                  title="Nombre de jours ouvrés entre la création et le traitement"
                  description={TREATMENT_DESCRIPTION}
                  chartType="pie"
                  labels={data.treatmentDelay.labels}
                  values={data.treatmentDelay.values}
                  unit="signalements"
                  columnHeaders={{
                    label: "Nombre de jours ouvrés",
                    value: "Nombre de signalements",
                  }}
                  exportFileName="delai-de-traitement"
                  onOpenFilters={openDrawer}
                />
              </div>
              <div className="order-7 lg:order-0">
                <StatCard
                  id="pertinence"
                  title="Pertinence des signalements"
                  chartType="pie"
                  labels={data.reportsRelevance.labels}
                  values={data.reportsRelevance.values}
                  unit="signalements"
                  columnHeaders={{
                    label: "Pertinence",
                    value: "Nombre de signalements",
                  }}
                  exportFileName="pertinence-des-signalements"
                  onOpenFilters={openDrawer}
                />
              </div>
            </div>
          </div>

          {/* Hors du masonry : le tableau des délais occupe toute la largeur,
              ses colonnes (équipe + délais) ne tiennent pas dans une colonne. */}
          <CareDelaysTable
            rows={careDelays ?? []}
            hasError={isCareDelaysError}
            isLoading={isCareDelaysLoading}
            onOpenFilters={openDrawer}
          />
        </div>
      )}
    </div>
  );
}
