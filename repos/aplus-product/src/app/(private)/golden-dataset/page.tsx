import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { GoldenDatasetAnnotator } from "./components/golden-dataset-annotator/golden-dataset-annotator";

export const metadata = {
  title: "Golden dataset",
};

export default async function GoldenDatasetPage() {
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
            currentPageLabel="Golden dataset"
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[]}
          />
          <h1 className="my-6">Annotation du golden dataset</h1>
          <p className="text-[#666]">
            Annotez chaque signalement caviardé avec deux tags libres d&apos;un
            à trois mots : le blocage rencontré et la démarche concernée. Les
            annotations des quatre administrateurs serviront de référence pour
            évaluer les futures propositions de l&apos;IA.
          </p>
          <div className="p-4 md:p-20 bg-white mt-8">
            <Suspense fallback={<p>Chargement du signalement…</p>}>
              <GoldenDatasetAnnotator />
            </Suspense>
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
