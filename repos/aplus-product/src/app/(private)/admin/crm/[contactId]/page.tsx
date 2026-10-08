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
import { trpc } from "@/trpc/server";
import { ContactDetail } from "../components/contact-detail/contact-detail";
import { SendEmailForm } from "../components/send-email-form/send-email-form";
import { ContactThread } from "../components/contact-thread/contact-thread";

interface ContactPageProps {
  params: Promise<{ contactId: string }>;
}

export async function generateMetadata({
  params,
}: ContactPageProps): Promise<Metadata> {
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

export default async function ContactPage({ params }: ContactPageProps) {
  const { contactId } = await params;
  const role = await getCurrentUserRole();

  if (role !== USER_ROLES.ADMIN) {
    redirect(ROUTE.ALL_REPORTS);
  }

  const queryClient = getQueryClient();
  let contact;
  try {
    contact = await queryClient.fetchQuery(
      trpc.crm.getContactById.queryOptions({ id: contactId }),
    );
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel={fullName}
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[
              { label: "Contacts", linkProps: { href: ROUTE.CONTACTS } },
            ]}
          />
          <h1 className="my-6">{fullName}</h1>
          <ContactDetail contactId={contactId} />
          <ContactThread contactId={contactId} />
          <SendEmailForm contactId={contactId} />
        </Container>
      </div>
    </HydrateClient>
  );
}
