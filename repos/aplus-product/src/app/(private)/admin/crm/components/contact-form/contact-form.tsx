"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import Select from "@codegouvfr/react-dsfr/Select";
import { useTRPC } from "@/trpc/client";
import { ROUTE } from "@/app/constant/route";
import type { AppRouter } from "@/trpc/routers/_app";
import { formatOrganizationLabel } from "@/utils/organization-label";
import { contactSchema, type ContactFormValues } from "../contact-schema";

type Contact = inferRouterOutputs<AppRouter>["crm"]["getContactById"];

interface ContactFormProps {
  contact?: Contact;
}

export function ContactForm({ contact }: ContactFormProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: areas } = useQuery(trpc.area.getAreas.queryOptions());
  const { data: organizations } = useQuery(
    trpc.organization.getOrganizations.queryOptions(),
  );

  const sortedAreas = useMemo(
    () => areas?.toSorted((a, b) => a.name.localeCompare(b.name)) ?? [],
    [areas],
  );
  const sortedOrganizations = useMemo(
    () => organizations?.toSorted((a, b) => a.name.localeCompare(b.name)) ?? [],
    [organizations],
  );

  const { control, handleSubmit } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      email: contact?.email ?? "",
      address: contact?.address ?? "",
      areaId: contact?.areaId ?? "",
      organizationId: contact?.organizationId ?? "",
    },
  });

  const { mutate: createContact, isPending: isCreating } = useMutation(
    trpc.crm.createContact.mutationOptions({
      onSuccess: () => router.push(ROUTE.CONTACTS),
      onError: (error) => setApiError(error.message),
    }),
  );

  const { mutate: updateContact, isPending: isUpdating } = useMutation(
    trpc.crm.updateContact.mutationOptions({
      onSuccess: () => {
        if (contact) router.push(`${ROUTE.CONTACTS}/${contact.id}`);
      },
      onError: (error) => setApiError(error.message),
    }),
  );

  const isPending = isCreating || isUpdating;

  function onSubmit(data: ContactFormValues) {
    setApiError(null);
    // Frontière avec le routeur : une chaîne vide signifie « champ vidé », que
    // le routeur n'efface que sur `null`.
    const values = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      address: data.address.trim() || null,
      areaId: data.areaId || null,
      organizationId: data.organizationId || null,
    };

    if (contact) {
      updateContact({ id: contact.id, ...values });
    } else {
      createContact(values);
    }
  }

  return (
    <div className="p-4 md:p-20 bg-white mt-8">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
        <Controller
          control={control}
          name="firstName"
          render={({ field, fieldState }) => (
            <Input
              className="md:w-1/2"
              id="contact-first-name"
              label="Prénom"
              state={fieldState.error ? "error" : "default"}
              stateRelatedMessage={fieldState.error?.message}
              nativeInputProps={{
                "aria-required": true,
                value: field.value,
                onChange: (e) => field.onChange(e.target.value),
              }}
            />
          )}
        />

        <Controller
          control={control}
          name="lastName"
          render={({ field, fieldState }) => (
            <Input
              className="md:w-1/2"
              id="contact-last-name"
              label="Nom"
              state={fieldState.error ? "error" : "default"}
              stateRelatedMessage={fieldState.error?.message}
              nativeInputProps={{
                "aria-required": true,
                value: field.value,
                onChange: (e) => field.onChange(e.target.value),
              }}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Input
              className="md:w-1/2"
              id="contact-email"
              label="Adresse e-mail"
              state={fieldState.error ? "error" : "default"}
              stateRelatedMessage={fieldState.error?.message}
              nativeInputProps={{
                type: "email",
                "aria-required": true,
                value: field.value,
                onChange: (e) => field.onChange(e.target.value),
              }}
            />
          )}
        />

        <Controller
          control={control}
          name="address"
          render={({ field, fieldState }) => (
            <Input
              className="md:w-1/2"
              id="contact-address"
              label="Adresse"
              state={fieldState.error ? "error" : "default"}
              stateRelatedMessage={fieldState.error?.message}
              nativeInputProps={{
                value: field.value,
                onChange: (e) => field.onChange(e.target.value),
              }}
            />
          )}
        />

        <Controller
          control={control}
          name="areaId"
          render={({ field }) => (
            <Select
              className="md:w-1/2"
              id="contact-area"
              label="Territoire"
              nativeSelectProps={{
                value: field.value,
                onChange: (e) => field.onChange(e.target.value),
              }}
            >
              <option value="">Non renseigné</option>
              {sortedAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          )}
        />

        <Controller
          control={control}
          name="organizationId"
          render={({ field }) => (
            <Select
              className="md:w-1/2"
              id="contact-organization"
              label="Organisme"
              nativeSelectProps={{
                value: field.value,
                onChange: (e) => field.onChange(e.target.value),
              }}
            >
              <option value="">Non renseigné</option>
              {sortedOrganizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {formatOrganizationLabel(organization)}
                </option>
              ))}
            </Select>
          )}
        />

        {apiError && (
          <Alert
            severity="error"
            description={apiError}
            small
            className="mt-4"
          />
        )}

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={isPending} size="large">
            {contact ? "Enregistrer les modifications" : "Créer le contact"}
          </Button>
        </div>
      </form>
    </div>
  );
}
