import { Suspense } from "react";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { TeamsContent } from "./components/teams-content/teams-content";
import { trpc, prefetch } from "@/trpc/server";
import { Spinner } from "@/app/component/spinner/spinner";

export const metadata = {
  title: "Équipes",
};

export default async function TeamsPage() {
  // Prefetch - await pour garantir les données dans le cache avant hydratation
  await prefetch(
    trpc.team.getMyTeams.queryOptions({
      page: 1,
      pageSize: 10,
      search: undefined,
      sortBy: "name",
      sortOrder: "asc",
    }),
  );

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Équipes"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <h1 className="my-6">Équipes</h1>
          <Suspense
            fallback={
              <div className="p-4 md:p-20 bg-white mt-8 relative">
                <div className="flex justify-center items-center py-12">
                  <Spinner />
                </div>
              </div>
            }
          >
            <TeamsContent />
          </Suspense>
        </Container>
      </div>
    </HydrateClient>
  );
}
