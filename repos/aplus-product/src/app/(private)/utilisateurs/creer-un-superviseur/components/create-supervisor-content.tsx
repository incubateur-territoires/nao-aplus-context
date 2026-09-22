"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ROUTE } from "@/app/constant/route";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { MultiSelectAutocomplete } from "@/app/component/multi-select-autocomplete/multi-select-autocomplete";
import {
  createSupervisorSchema,
  type CreateSupervisorFormValues,
} from "./create-supervisor-schema";

// Libellé d'une organisation : « Nom (Sigle) » si un sigle distinct existe.
function getOrgLabel(org: { name: string; shortName: string | null }) {
  return org.shortName && org.shortName !== org.name
    ? `${org.name} (${org.shortName})`
    : org.name;
}

export function CreateSupervisorContent() {
  const router = useRouter();
  const trpc = useTRPC();
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: areas } = useQuery(trpc.area.getAreas.queryOptions());
  const { data: organizations } = useQuery(
    trpc.organization.getOrganizations.queryOptions(),
  );

  const sortedOrganizations = useMemo(
    () => organizations?.toSorted((a, b) => a.name.localeCompare(b.name)),
    [organizations],
  );

  const formMethods = useForm<CreateSupervisorFormValues>({
    resolver: zodResolver(createSupervisorSchema),
    defaultValues: {
      email: "",
      areaIds: [],
      organizationIds: [],
    },
  });

  const { mutateAsync: createSupervisor, isPending } = useMutation(
    trpc.supervisor.createSupervisor.mutationOptions({
      onSuccess: () => {
        setApiError(null);
        router.push(ROUTE.USERS);
      },
      onError: (error) => {
        setApiError(
          error.message ||
            "Une erreur est survenue lors de la création du superviseur",
        );
      },
    }),
  );

  async function onSubmit(data: CreateSupervisorFormValues) {
    setApiError(null);
    await createSupervisor({
      email: data.email,
      areaIds: data.areaIds,
      organizationIds: data.organizationIds,
    });
  }

  return (
    <div className="p-4 md:p-20 bg-white mt-8">
      <p>
        L&apos;utilisateur sera <strong>Superviseur de territoire</strong> si un
        ou plusieurs départements sont sélectionnés dans le menu ci-dessous. il
        sera <strong>Superviseur d&apos;organisation</strong> si une ou
        plusieurs organisations sont sélectionnées dans le menu ci-dessous.
      </p>

      <form
        onSubmit={formMethods.handleSubmit(onSubmit)}
        className="mt-8 flex flex-col"
      >
        <Controller
          control={formMethods.control}
          name="email"
          render={({ field, fieldState }) => (
            <Input
              className="md:w-1/3"
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
          control={formMethods.control}
          name="areaIds"
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-4 mb-4">
              <div className="md:w-2/3">
                <MultiSelectAutocomplete
                  id="supervisor-areas"
                  label="Superviseur de territoire"
                  placeholder="Choisissez un ou plusieurs départements"
                  options={areas ?? []}
                  value={field.value}
                  onChange={field.onChange}
                  getOptionLabel={(option) => option.name}
                  noOptionsText="Aucun département trouvé"
                  error={!!fieldState.error}
                  chipsContainerAriaLabel="Territoires sélectionnés"
                />
              </div>
              {fieldState.error && (
                <p className="fr-error-text -mt-2">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />

        <Controller
          control={formMethods.control}
          name="organizationIds"
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-4 mb-4">
              <div className="md:w-2/3">
                <MultiSelectAutocomplete
                  id="supervisor-organizations"
                  label="Superviseur d'organisation"
                  placeholder="Choisissez une ou plusieurs organisations"
                  options={sortedOrganizations ?? []}
                  value={field.value}
                  onChange={field.onChange}
                  getOptionLabel={getOrgLabel}
                  renderOptionContent={(option) => (
                    <>
                      {option.name}
                      {option.shortName && option.shortName !== option.name && (
                        <span className="ml-1 text-(--text-mention-grey)">
                          ({option.shortName})
                        </span>
                      )}
                    </>
                  )}
                  noOptionsText="Aucune organisation trouvée"
                  error={!!fieldState.error}
                  chipsContainerAriaLabel="Organisations sélectionnées"
                />
              </div>
              {fieldState.error && (
                <p className="fr-error-text -mt-2">
                  {fieldState.error.message}
                </p>
              )}
            </div>
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
          <Button
            type="submit"
            disabled={isPending}
            iconId="ri-user-add-line"
            size="large"
          >
            Créer le superviseur
          </Button>
        </div>
      </form>
    </div>
  );
}
