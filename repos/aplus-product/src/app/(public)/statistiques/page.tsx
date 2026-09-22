import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { trpc, prefetch } from "@/trpc/server";
import { parseStatsFiltersFromRecord } from "@/utils/stats-filters-url";
import { StatistiquesContent } from "./components/statistiques-content/statistiques-content";
import { FiltersMemoryAlert } from "./components/filters-memory-alert/filters-memory-alert";

export const metadata = {
  title: "Statistiques",
};

interface StatistiquesV2Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StatistiquesV2({
  searchParams,
}: StatistiquesV2Props) {
  // Filtres initiaux lus depuis l'URL → pages filtrées partageables, avec un
  // SSR correct (les bons graphiques sont rendus dès le premier paint).
  const initialFilters = parseStatsFiltersFromRecord(await searchParams);

  // Précharge les données côté serveur et hydrate le cache : le premier rendu
  // affiche directement les graphiques, sans cascade de requêtes côté client.
  // Les requêtes sont indépendantes → on les parallélise.
  await Promise.all([
    prefetch(trpc.stats.getFilterOptions.queryOptions(initialFilters)),
    prefetch(trpc.stats.getDashboard.queryOptions(initialFilters)),
    prefetch(trpc.stats.getCareDelaysByTeam.queryOptions(initialFilters)),
  ]);

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Statistiques"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <FiltersMemoryAlert className="mb-6" />
          <h1>Statistiques</h1>
          <StatistiquesContent initialFilters={initialFilters} />
        </Container>
      </div>
    </HydrateClient>
  );
}
