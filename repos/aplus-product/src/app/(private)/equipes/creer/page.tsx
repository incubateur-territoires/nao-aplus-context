import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { CreateTeamContent } from "./components/create-team-content";
import { trpc, prefetch } from "@/trpc/server";

export const metadata = {
  title: "Créer une équipe - Équipes",
};

export const dynamic = "force-dynamic";

export default async function CreateTeamPage() {
  // Prefetch en parallèle - await pour garantir les données dans le cache avant hydratation
  await Promise.all([
    prefetch(trpc.organization.getMyManagedOrganizations.queryOptions()),
    prefetch(trpc.area.getMyAreas.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Créer une équipe"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[
              {
                label: "Équipes",
                linkProps: {
                  href: ROUTE.TEAMS,
                },
              },
            ]}
          />
          <div className="gap-4 my-6">
            <h1>Créer une équipe</h1>
          </div>
          <CreateTeamContent />
        </Container>
      </div>
    </HydrateClient>
  );
}
