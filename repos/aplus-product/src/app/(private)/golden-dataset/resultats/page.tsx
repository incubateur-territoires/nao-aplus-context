import { redirect } from "next/navigation";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { GoldenDatasetOverview } from "./components/golden-dataset-overview/golden-dataset-overview";

export const metadata = {
  title: "Golden dataset — restitution",
};

export default async function GoldenDatasetResultsPage() {
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
            currentPageLabel="Restitution"
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[
              {
                label: "Golden dataset",
                linkProps: { href: ROUTE.GOLDEN_DATASET },
              },
            ]}
          />
          <h1 className="my-6">Restitution des annotations</h1>
          <p className="text-[#666]">
            Une carte par signalement : son contenu caviardé, puis les tags de
            chaque annotateur, suivis de ceux de chaque série de modèles, pour
            comparer humains et modèles d&apos;un coup d&apos;œil.
          </p>
          <div className="p-4 md:p-20 bg-white mt-8">
            <GoldenDatasetOverview />
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
