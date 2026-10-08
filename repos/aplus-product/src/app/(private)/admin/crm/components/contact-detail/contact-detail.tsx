"use client";

import { useQuery } from "@tanstack/react-query";
import Button from "@codegouvfr/react-dsfr/Button";
import { useTRPC } from "@/trpc/client";
import { ROUTE } from "@/app/constant/route";
import { formatOrganizationLabel } from "@/utils/organization-label";

interface ContactDetailProps {
  contactId: string;
}

export function ContactDetail({ contactId }: ContactDetailProps) {
  const trpc = useTRPC();
  const { data: contact } = useQuery(
    trpc.crm.getContactById.queryOptions({ id: contactId }),
  );

  if (!contact) return null;

  const fields = [
    { label: "Adresse e-mail", value: contact.email },
    { label: "Adresse", value: contact.address || "-" },
    { label: "Territoire", value: contact.area?.name ?? "-" },
    {
      label: "Organisme",
      value: contact.organization
        ? formatOrganizationLabel(contact.organization)
        : "-",
    },
  ];

  return (
    <section className="p-4 md:p-20 bg-white mt-8">
      <h2>Informations du contact</h2>
      <dl className="mt-6 grid gap-6 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="font-bold">{field.label}</dt>
            <dd className="mt-1 break-words">{field.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-end mt-8">
        <Button
          priority="secondary"
          linkProps={{ href: `${ROUTE.EDIT_CONTACT}/${contactId}` }}
        >
          Modifier le contact
        </Button>
      </div>
    </section>
  );
}
