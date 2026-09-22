import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { HydrateClient } from "@/trpc/hydrate-client";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { NewPasswordContent } from "./components/content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nouveau mot de passe",
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function NewPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <div className="max-w-[640px] mx-auto">
            <div className="pt-2 pb-6">
              <Breadcrumb
                currentPageLabel="Nouveau mot de passe"
                homeLinkProps={{
                  href: ROUTE.HOME,
                }}
                segments={[]}
              />
            </div>
            <h1>Nouveau mot de passe</h1>
            <NewPasswordContent token={token} />
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
