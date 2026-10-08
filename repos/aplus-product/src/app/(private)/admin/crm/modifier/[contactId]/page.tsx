import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { getQueryClient, HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { trpc, prefetch } from "@/trpc/server";
import { ContactForm } from "../../components/contact-form/contact-form";

interface EditContactPageProps {
  params: Promise<{ contactId: string }>;
}

export async function generateMetadata({
  params,
}: EditContactPageProps): Promise<Metadata> {
  const { contactId } = await params;
  const queryClient = getQueryClient();
  try {
    const contact = await queryClient.fetchQuery(
      trpc.crm.getContactById.queryOptions({ id: contactId }),
    );
    return { title: `${contact.firstName} ${contact.lastName}` };
  } catch {
    return { title: "Contact" };
  }
}

export default async function EditContactPage({
  params,
}: EditContactPageProps) {
  const { contactId } = await params;
  const role = await getCurrentUserRole();

  if (role !== USER_ROLES.ADMIN) {
    redirect(ROUTE.ALL_REPORTS);
  }

  const queryClient = getQueryClient();
  let contact;
  try {
    [contact] = await Promise.all([
      queryClient.fetchQuery(
        trpc.crm.getContactById.queryOptions({ id: contactId }),
      ),
      prefetch(trpc.area.getAreas.queryOptions()),
      prefetch(trpc.organization.getOrganizations.queryOptions()),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel={`${contact.firstName} ${contact.lastName}`}
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[
              { label: "Contacts", linkProps: { href: ROUTE.CONTACTS } },
            ]}
          />
          <h1 className="my-6">Modifier le contact</h1>
          <ContactForm contact={contact} />
        </Container>
      </div>
    </HydrateClient>
  );
}
