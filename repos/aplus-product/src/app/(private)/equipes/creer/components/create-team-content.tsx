"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ROUTE } from "@/app/constant/route";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import Select from "@codegouvfr/react-dsfr/Select";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { MultiSelectAutocomplete } from "@/app/component/multi-select-autocomplete/multi-select-autocomplete";
import {
  createTeamSchema,
  type CreateTeamFormValues,
} from "./create-team-schema";
import { ExistingTeamsAlert } from "./existing-teams-alert/existing-teams-alert";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { USER_ROLES } from "@/constants/user-roles";
import { TEAM_TYPE_LABELS } from "@/constants/team-types";
import { TeamType } from "@/generated/prisma/enums";
import {
  HELPER_TYPE_OPTIONS,
  getTeamTypeOnOrganizationChange,
} from "@/utils/team-type";

export function CreateTeamContent() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);
  const currentUser = useSession();
  const isAdmin = currentUser.data?.user?.role === USER_ROLES.ADMIN;
  const isSupervisor = currentUser.data?.user?.role === USER_ROLES.SUPERVISOR;

  const { data: organizations } = useQuery(
    trpc.organization.getMyManagedOrganizations.queryOptions(),
  );
  const { data: areas } = useQuery(trpc.area.getMyAreas.queryOptions());
  const { data: managerTeamTypeInfo } = useQuery({
    ...trpc.team.getManagerInheritedTeamType.queryOptions(),
    enabled: !isAdmin && !isSupervisor,
  });

  const canChooseTeamType =
    !isAdmin && !isSupervisor && managerTeamTypeInfo?.hasDifferentTypes;
  const inheritedTeamType =
    !isAdmin &&
    !isSupervisor &&
    managerTeamTypeInfo &&
    !managerTeamTypeInfo.hasDifferentTypes
      ? managerTeamTypeInfo.type
      : null;

  const sortedOrganizations = useMemo(
    () =>
      organizations
        ?.slice()
        .sort((a, b) => a.shortName.localeCompare(b.shortName)),
    [organizations],
  );

  const hasSingleOrganization = sortedOrganizations?.length === 1;

  const schema = useMemo(
    () => createTeamSchema(sortedOrganizations),
    [sortedOrganizations],
  );

  const formMethods = useForm<CreateTeamFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      organizationId: "",
      areaIds: [],
      email: "",
      description: "",
      registrationNumber: "",
    },
  });

  // Auto-set organizationId and type when user has only one organization
  useEffect(() => {
    if (hasSingleOrganization && sortedOrganizations?.[0]) {
      formMethods.setValue("organizationId", sortedOrganizations[0].id);
      const autoType = getTeamTypeOnOrganizationChange(sortedOrganizations[0]);
      if (autoType) {
        formMethods.setValue("type", autoType);
      }
    }
  }, [hasSingleOrganization, sortedOrganizations, formMethods]);

  const selectedOrganizationId = formMethods.watch("organizationId");
  const selectedAreaIds = formMethods.watch("areaIds");

  const { data: existingTeams } = useQuery({
    ...trpc.team.getExistingTeamsByOrganizationAndAreas.queryOptions({
      organizationId: selectedOrganizationId,
      areaIds: selectedAreaIds,
    }),
    enabled: !!selectedOrganizationId && selectedAreaIds.length > 0,
    placeholderData: keepPreviousData,
  });

  const { mutateAsync: createTeam, isPending } = useMutation(
    trpc.team.createTeam.mutationOptions({
      onSuccess: async (team) => {
        setApiError(null);
        await queryClient.invalidateQueries({
          queryKey: [["team", "getMyTeams"]],
        });
        router.push(`${ROUTE.TEAMS}/${team.id}`);
      },
      onError: (error) => {
        const message =
          error.message ||
          "Une erreur est survenue lors de la création de l'équipe";
        if (
          message ===
          "Ce matricule correspond à une équipe qui existe déjà sur Administration+. Veuillez saisir un autre matricule."
        ) {
          formMethods.setError("registrationNumber", { message });
        } else {
          setApiError(message);
        }
        console.error(error);
      },
    }),
  );

  const selectedOrganization = sortedOrganizations?.find(
    (org) => org.id === formMethods.watch("organizationId"),
  );

  const isOperatorOrganization =
    selectedOrganization?.type === TeamType.OPERATOR;
  const isFranceServiceOrg =
    selectedOrganization?.type === TeamType.FRANCE_SERVICE;

  const hasSelectedOrganization = !!selectedOrganizationId;

  async function onSubmit(data: CreateTeamFormValues) {
    setApiError(null);
    await createTeam({
      name: data.name,
      organizationId: data.organizationId,
      areaIds: data.areaIds,
      email: data.email || null,
      description: data.description || null,
      registrationNumber: data.registrationNumber || null,
      type:
        isAdmin || isSupervisor || canChooseTeamType ? data.type : undefined,
    });
  }

  return (
    <div className="p-4 md:p-20 bg-white mt-8">
      <h2 className="text-[32px] leading-[40px] font-bold text-[#161616]">
        Informations de l&apos;équipe
      </h2>
      <p className="mt-2">
        Tous les champs sont obligatoires sauf mention contraire.
      </p>

      <FormProvider {...formMethods}>
        <form
          onSubmit={formMethods.handleSubmit(onSubmit)}
          className="mt-8 flex flex-col"
        >
          {hasSingleOrganization ? (
            <p className="mb-4">
              Type d&apos;organisation&nbsp;:{" "}
              <span className="font-bold">
                {sortedOrganizations?.[0]?.shortName} -{" "}
                {sortedOrganizations?.[0]?.name}
              </span>
            </p>
          ) : (
            <Controller
              control={formMethods.control}
              name="organizationId"
              render={({ field }) => (
                <Select
                  className="md:w-1/3"
                  state={
                    formMethods.formState.errors.organizationId
                      ? "error"
                      : "default"
                  }
                  stateRelatedMessage={
                    formMethods.formState.errors.organizationId?.message
                  }
                  label="Type d'organisation"
                  nativeSelectProps={{
                    "aria-required": true,
                    value: field.value,
                    onChange: (e) => {
                      field.onChange(e.target.value);
                      const org = sortedOrganizations?.find(
                        (o) => o.id === e.target.value,
                      );
                      const autoType = getTeamTypeOnOrganizationChange(org);
                      if (autoType) {
                        formMethods.setValue("type", autoType);
                      }
                    },
                  }}
                >
                  <option value="" disabled>
                    Sélectionner une organisation
                  </option>
                  {sortedOrganizations?.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.shortName} - {org.name}
                    </option>
                  ))}
                </Select>
              )}
            />
          )}

          {!hasSelectedOrganization ? null : isOperatorOrganization ? (
            <RadioButtons
              legend="Catégorie de l'équipe"
              disabled
              options={[
                {
                  label: "Opérateurs",
                  nativeInputProps: {
                    name: "teamType",
                    value: TeamType.OPERATOR,
                    checked: true,
                    readOnly: true,
                  },
                },
              ]}
            />
          ) : isFranceServiceOrg ? (
            <RadioButtons
              legend="Catégorie de l'équipe aidante"
              disabled
              options={[
                {
                  label: "France Services",
                  nativeInputProps: {
                    name: "teamType",
                    value: TeamType.FRANCE_SERVICE,
                    checked: true,
                    readOnly: true,
                  },
                },
              ]}
            />
          ) : isAdmin || isSupervisor || canChooseTeamType ? (
            <Controller
              control={formMethods.control}
              name="type"
              render={({ field }) => (
                <RadioButtons
                  legend="Catégorie de l'équipe aidante"
                  id={field.name}
                  // Le DSFR référence par défaut le message d'erreur dans aria-labelledby
                  // (donc dans le *nom* du groupe). On limite le nom à la légende et on
                  // expose l'erreur comme *description* via aria-describedby (a11y).
                  aria-labelledby={`${field.name}-legend`}
                  aria-describedby={`${field.name}-messages`}
                  state={
                    formMethods.formState.errors.type ? "error" : "default"
                  }
                  stateRelatedMessage={
                    formMethods.formState.errors.type?.message
                  }
                  options={HELPER_TYPE_OPTIONS.map((option) => ({
                    label: option.label,
                    nativeInputProps: {
                      name: "teamType",
                      value: option.value,
                      checked: field.value === option.value,
                      onChange: () => field.onChange(option.value),
                    },
                  }))}
                />
              )}
            />
          ) : inheritedTeamType ? (
            <Alert
              severity="info"
              small
              description={`Le type de l'équipe sera automatiquement défini à « ${TEAM_TYPE_LABELS[inheritedTeamType]} » (hérité de votre première équipe).`}
              className="mb-6"
            />
          ) : null}

          <Controller
            control={formMethods.control}
            name="areaIds"
            render={({ field, fieldState }) => (
              <div className="md:w-1/3 mb-4">
                <MultiSelectAutocomplete
                  id="area-autocomplete"
                  label="Territoire"
                  placeholder="Choisissez un ou plusieurs départements"
                  options={areas ?? []}
                  value={field.value}
                  onChange={field.onChange}
                  getOptionLabel={(option) => option.name}
                  noOptionsText="Aucun territoire trouvé"
                  clearable
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  chipsContainerAriaLabel="Territoires sélectionnés"
                />
              </div>
            )}
          />

          {existingTeams &&
            existingTeams.length > 0 &&
            selectedAreaIds.length > 0 && (
              <ExistingTeamsAlert teams={existingTeams} />
            )}

          {isFranceServiceOrg ? (
            <Controller
              control={formMethods.control}
              name="registrationNumber"
              render={({ field }) => (
                <Input
                  className="md:w-1/3"
                  state={
                    formMethods.formState.errors.registrationNumber
                      ? "error"
                      : "default"
                  }
                  stateRelatedMessage={
                    formMethods.formState.errors.registrationNumber?.message
                  }
                  label="Matricule"
                  nativeInputProps={{
                    value: field.value ?? "",
                    onChange: (e) => {
                      field.onChange(e.target.value || null);
                      formMethods.clearErrors("registrationNumber");
                    },
                  }}
                />
              )}
            />
          ) : null}

          <Controller
            control={formMethods.control}
            name="name"
            render={({ field }) => (
              <Input
                className="md:w-1/3"
                state={formMethods.formState.errors.name ? "error" : "default"}
                stateRelatedMessage={formMethods.formState.errors.name?.message}
                label="Nom de l'équipe"
                nativeInputProps={{
                  "aria-required": true,
                  value: field.value,
                  onChange: (e) => field.onChange(e.target.value),
                }}
              />
            )}
          />

          <Controller
            control={formMethods.control}
            name="email"
            render={({ field }) => (
              <Input
                className="md:w-1/3"
                state={formMethods.formState.errors.email ? "error" : "default"}
                stateRelatedMessage={
                  formMethods.formState.errors.email?.message
                }
                label="Adresse e-mail de l'équipe (optionnel)"
                hintText="Adresse générique pour inscriptions et notifications. Format attendu : nom@domaine.fr"
                nativeInputProps={{
                  type: "email",
                  value: field.value ?? "",
                  onChange: (e) => field.onChange(e.target.value || null),
                }}
              />
            )}
          />

          <Controller
            control={formMethods.control}
            name="description"
            render={({ field }) => (
              <Input
                className="md:w-1/2"
                state={
                  formMethods.formState.errors.description ? "error" : "info"
                }
                stateRelatedMessage={
                  formMethods.formState.errors.description?.message ??
                  "Pour apporter une précision sur la zone géographique concernée, la thématique de résolution associée ou toute autre information utile à la sélection de l’équipe dans le cadre d’un signalement."
                }
                label="Description (optionnel)"
                textArea
                nativeTextAreaProps={{
                  value: field.value ?? "",
                  onChange: (e) => field.onChange(e.target.value || null),
                  rows: 5,
                }}
              />
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
              iconId="ri-add-line"
              size="large"
            >
              Créer l&apos;équipe
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
