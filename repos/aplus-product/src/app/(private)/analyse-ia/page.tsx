import { redirect } from "next/navigation";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { AnalyseRunner } from "./components/analyse-runner/analyse-runner";

export const metadata = {
  title: "Analyse IA",
};

export default async function AnalyseIaPage() {
  const role = await getCurrentUserRole();

  if (role !== USER_ROLES.ADMIN) {
    redirect(ROUTE.ALL_REPORTS);
  }

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Analyse IA"
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[]}
          />
          <h1 className="my-6">Analyse IA des signalements</h1>
          <p className="text-[#666]">
            Lance le pipeline IA (anonymisation + résumé + tags générés
            librement) sur un échantillon de signalements. Les tags proposés
            sont agrégés ci-dessous pour faire émerger une première taxonomie.
          </p>
          <AnalyseRunner />
        </Container>
      </div>
    </HydrateClient>
  );
}
