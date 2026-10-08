import { redirect } from "next/navigation";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { trpc, prefetch } from "@/trpc/server";
import { ContactForm } from "../components/contact-form/contact-form";

export const metadata = {
  title: "Ajouter un contact",
};

export default async function CreateContactPage() {
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
            currentPageLabel="Ajouter un contact"
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[
              { label: "Contacts", linkProps: { href: ROUTE.CONTACTS } },
            ]}
          />
          <h1 className="my-6">Ajouter un contact</h1>
          <ContactForm />
        </Container>
      </div>
    </HydrateClient>
  );
}
