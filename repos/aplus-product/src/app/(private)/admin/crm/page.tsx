import { Suspense } from "react";
import { redirect } from "next/navigation";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import { Spinner } from "@/app/component/spinner/spinner";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { trpc, prefetch } from "@/trpc/server";
import { ContactsContent } from "./components/contacts-content/contacts-content";

export const metadata = {
  title: "Contacts",
};

export default async function ContactsPage() {
  const role = await getCurrentUserRole();

  if (role !== USER_ROLES.ADMIN) {
    redirect(ROUTE.ALL_REPORTS);
  }

  // Mêmes arguments que le premier appel client, sinon la clé de cache diffère
  // et le préchargement ne sert à rien.
  await prefetch(
    trpc.crm.getContacts.queryOptions({
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
            currentPageLabel="Contacts"
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[]}
          />
          <h1 className="my-6">Contacts</h1>
          <Suspense
            fallback={
              <div className="p-4 md:p-20 bg-white mt-6 relative">
                <div className="flex justify-center items-center py-12">
                  <Spinner />
                </div>
              </div>
            }
          >
            <ContactsContent />
          </Suspense>
        </Container>
      </div>
    </HydrateClient>
  );
}
