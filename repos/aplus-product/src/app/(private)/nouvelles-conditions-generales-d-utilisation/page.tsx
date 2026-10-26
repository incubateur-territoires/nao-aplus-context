import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { HydrateClient } from "@/trpc/hydrate-client";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { CguAcceptanceContent } from "./components/cgu-acceptance-content/cgu-acceptance-content";

export const metadata = {
  title: "Nouvelles conditions générales d'utilisation",
};

export default function CguAcceptancePage() {
  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <div className="max-w-[640px] mx-auto">
            <div className="pt-2 pb-6">
              <Breadcrumb
                currentPageLabel="Nouvelles conditions générales d'utilisation"
                homeLinkProps={{
                  href: ROUTE.HOME,
                }}
                segments={[]}
              />
            </div>
            <h1>Nouvelles conditions générales d&apos;utilisation</h1>
            <div className="p-4 md:p-20 bg-white mt-8">
              <CguAcceptanceContent />
            </div>
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
