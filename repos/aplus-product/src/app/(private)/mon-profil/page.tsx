import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { HydrateClient, getQueryClient } from "@/trpc/hydrate-client";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ProfileContent } from "./components/profile-content/profile-content";
import { getServerTRPCCaller } from "@/trpc/server-utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mon profil",
};

export default async function ProfilePage() {
  const queryClient = getQueryClient();
  const caller = await getServerTRPCCaller();

  await queryClient.prefetchQuery({
    queryKey: [["user", "getCurrentUser"], { type: "query" }],
    queryFn: () => caller.user.getCurrentUser(),
  });

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <div className="max-w-[640px] mx-auto">
            <div className="pt-2 pb-6">
              <Breadcrumb
                currentPageLabel="Mon profil"
                homeLinkProps={{
                  href: ROUTE.HOME,
                }}
                segments={[]}
              />
            </div>
            <h1 className="mb-8">Profil</h1>
            <ProfileContent />
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
