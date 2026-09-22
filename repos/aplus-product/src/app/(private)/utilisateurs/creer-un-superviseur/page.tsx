import { redirect } from "next/navigation";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { trpc, prefetch } from "@/trpc/server";
import { CreateSupervisorContent } from "./components/create-supervisor-content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Créer un superviseur",
};

export default async function CreateSupervisorPage() {
  const role = await getCurrentUserRole();

  if (role !== USER_ROLES.ADMIN) {
    redirect(ROUTE.ALL_REPORTS);
  }

  await Promise.all([
    prefetch(trpc.area.getAreas.queryOptions()),
    prefetch(trpc.organization.getOrganizations.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Créer un superviseur"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[
              {
                label: "Utilisateurs",
                linkProps: {
                  href: ROUTE.USERS,
                },
              },
            ]}
          />
          <h1 className="my-6">Créer un superviseur</h1>
          <CreateSupervisorContent />
        </Container>
      </div>
    </HydrateClient>
  );
}
