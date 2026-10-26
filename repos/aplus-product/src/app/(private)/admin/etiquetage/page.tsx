import { redirect } from "next/navigation";
import { getQueryClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { trpc } from "@/trpc/server";
import { USER_ROLES } from "@/constants/user-roles";
import { TaggingDashboard } from "./components/tagging-dashboard/tagging-dashboard";

export const metadata = {
  title: "Étiquetage IA",
};

export default async function TaggingStatsPage() {
  const role = await getCurrentUserRole();

  if (role !== USER_ROLES.ADMIN) {
    redirect(ROUTE.ALL_REPORTS);
  }

  const stats = await getQueryClient().fetchQuery(
    trpc.taggingStats.get.queryOptions(),
  );

  return (
    <>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Étiquetage IA"
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[
              {
                label: "Administration",
                linkProps: { href: ROUTE.ADMINISTRATION },
              },
            ]}
          />
          <h1 className="my-6">Étiquetage IA</h1>
          <TaggingDashboard stats={stats} />
        </Container>
      </div>
    </>
  );
}
