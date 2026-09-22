import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { HydrateClient } from "@/trpc/hydrate-client";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { FinishRegistrationContent } from "./components/content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Terminer l'inscription",
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function FinishRegistrationPage({
  searchParams,
}: PageProps) {
  const { token } = await searchParams;

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <div className="max-w-[640px] mx-auto">
            <div className="pt-2 pb-6">
              <Breadcrumb
                currentPageLabel="Terminer l'inscription"
                homeLinkProps={{
                  href: ROUTE.HOME,
                }}
                segments={[]}
              />
            </div>
            <h1>Terminer l&apos;inscription</h1>
            <FinishRegistrationContent token={token} />
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
