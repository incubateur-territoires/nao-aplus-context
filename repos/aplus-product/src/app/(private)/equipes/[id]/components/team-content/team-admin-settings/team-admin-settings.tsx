"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Button from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import Select from "@codegouvfr/react-dsfr/Select";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import Input from "@codegouvfr/react-dsfr/Input";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { MultiSelectAutocomplete } from "@/app/component/multi-select-autocomplete/multi-select-autocomplete";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { USER_ROLES } from "@/constants/user-roles";
import { ROUTE } from "@/app/constant/route";
import { TeamType } from "@/generated/prisma/enums";
import {
  HELPER_TYPE_OPTIONS,
  getTeamTypeOnOrganizationChange,
} from "@/utils/team-type";
import { TeamDeletionPreview } from "../team-deletion-preview/team-deletion-preview";
import { useFocusOnVisible } from "@/app/hooks/use-focus-on-visible";

const teamAdminSettingsSchema = z.object({
  areaIds: z.array(z.string()).min(1, "Au moins un territoire est requis"),
  organizationId: z.string().min(1, "L'organisation est requise"),
  adminComment: z.string().nullable(),
  type: z.nativeEnum(TeamType),
});

type TeamAdminSettingsFormValues = z.infer<typeof teamAdminSettingsSchema>;

const deleteModal = createModal({
  id: "delete-team-modal",
  isOpenedByDefault: false,
});

export function TeamAdminSettings({ teamId }: { teamId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const currentUser = useSession();

  const isAdmin = currentUser.data?.user?.role === USER_ROLES.ADMIN;
  const isSupervisor = currentUser.data?.user?.role === USER_ROLES.SUPERVISOR;
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const alertRef = useFocusOnVisible(showSuccessAlert);

  // Données déjà prefetch côté serveur - pas de loading state
  const { data: team } = useQuery(trpc.team.getTeamById.queryOptions(teamId));
  const { data: areas } = useQuery(
    isAdmin
      ? trpc.area.getAreas.queryOptions()
      : trpc.area.getMyAreas.queryOptions(),
  );
  const { data: organizations } = useQuery(
    trpc.organization.getOrganizations.queryOptions(),
  );

  const formMethods = useForm<TeamAdminSettingsFormValues>({
    resolver: zodResolver(teamAdminSettingsSchema),
    defaultValues: {
      areaIds: [],
      organizationId: "",
      adminComment: null,
      type: TeamType.OTHERS_HELPERS,
    },
  });

  const lastTeamIdRef = useRef<string | null>(null);

  if (team && team.id !== lastTeamIdRef.current) {
    formMethods.reset({
      areaIds: team.areas?.map((area) => area.id) || [],
      organizationId: team.organizationId,
      adminComment: team.adminComment ?? null,
      type: team.type,
    });
    lastTeamIdRef.current = team.id;
  }

  const { mutateAsync: updateTeamAdmin, isPending: isPendingAdmin } =
    useMutation(
      trpc.team.updateTeamAdmin.mutationOptions({
        onSuccess: async () => {
          await queryClient.refetchQueries(
            trpc.team.getTeamById.queryOptions(teamId),
          );
          setShowSuccessAlert(true);
        },
      }),
    );

  const { mutateAsync: updateTeamAreas, isPending: isPendingSupervisor } =
    useMutation(
      trpc.team.updateTeamAreas.mutationOptions({
        onSuccess: async () => {
          await queryClient.refetchQueries(
            trpc.team.getTeamById.queryOptions(teamId),
          );
          setShowSuccessAlert(true);
        },
      }),
    );

  const isPending = isPendingAdmin || isPendingSupervisor;

  const { mutateAsync: deleteTeam, isPending: isDeleting } = useMutation(
    trpc.team.deleteTeam.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: [["team", "getMyTeams"]],
        });
        router.push(ROUTE.TEAMS);
      },
    }),
  );

  async function onSubmit(data: TeamAdminSettingsFormValues) {
    setShowSuccessAlert(false);
    try {
      if (isAdmin) {
        await updateTeamAdmin({
          id: teamId,
          areaIds: data.areaIds,
          organizationId: data.organizationId,
          adminComment: data.adminComment,
          type: data.type,
        });
      } else {
        await updateTeamAreas({
          id: teamId,
          areaIds: data.areaIds,
        });
      }
    } catch (error) {
      console.error("Error updating team:", error);
    }
  }

  async function handleDeleteTeam() {
    try {
      await deleteTeam(teamId);
    } catch (error) {
      console.error("Error deleting team:", error);
    }
  }

  const selectedOrganizationId = formMethods.watch("organizationId");

  const areaOptions = useMemo(() => areas ?? [], [areas]);

  const selectedOrganization = useMemo(
    () => organizations?.find((org) => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId],
  );

  const isOperatorOrganization =
    selectedOrganization?.type === TeamType.OPERATOR;
  const isFranceServiceOrg =
    selectedOrganization?.type === TeamType.FRANCE_SERVICE;

  if (!isAdmin && !isSupervisor) {
    return null;
  }

  if (!team) {
    return null;
  }

  return (
    <div className="p-4 md:p-20 bg-white relative mt-5">
      <div className="flex flex-col gap-10">
        {showSuccessAlert && (
          <div ref={alertRef} tabIndex={-1}>
            <Alert
              severity="success"
              role="status"
              title="Les modifications ont bien été enregistrées."
              closable
              onClose={() => setShowSuccessAlert(false)}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h2 className="text-[32px] leading-[40px] font-bold text-[#161616]">
            Administration de l&apos;équipe
          </h2>
          <p className="text-[#3a3a3a] italic">
            {isAdmin
              ? "Seuls les administrateurs ont accès à ces paramètres."
              : "Paramètres réservés aux administrateurs et superviseurs."}
          </p>
        </div>

        <form onSubmit={formMethods.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-10">
            <Controller
              control={formMethods.control}
              name="areaIds"
              render={({ field, fieldState }) => (
                <div className="w-full md:w-[400px]">
                  <MultiSelectAutocomplete
                    id="team-areas"
                    label="Territoire(s)"
                    placeholder="Choisissez un ou plusieurs territoires"
                    options={areaOptions}
                    value={field.value}
                    // Valide à chaque changement pour afficher l'erreur « au moins
                    // un territoire » dès la suppression du dernier chip (RGAA).
                    onChange={(ids) => {
                      field.onChange(ids);
                      void formMethods.trigger("areaIds");
                    }}
                    getOptionLabel={(option) => option.name}
                    noOptionsText="Aucun territoire trouvé"
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    chipsContainerAriaLabel="Territoires sélectionnés"
                  />
                </div>
              )}
            />

            {isAdmin && (
              <Controller
                control={formMethods.control}
                name="organizationId"
                render={({ field, fieldState }) => (
                  <div className="w-[640px]">
                    <Select
                      label="Type d'organisation"
                      state={fieldState.error ? "error" : "default"}
                      stateRelatedMessage={fieldState.error?.message}
                      nativeSelectProps={{
                        value: field.value,
                        onChange: (e) => {
                          field.onChange(e.target.value);
                          const org = organizations?.find(
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
                      {organizations?.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.shortName} - {org.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              />
            )}

            {isAdmin && (
              <Controller
                control={formMethods.control}
                name="type"
                render={({ field }) =>
                  isOperatorOrganization ? (
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
                  ) : (
                    <RadioButtons
                      legend="Catégorie de l'équipe aidante"
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
                  )
                }
              />
            )}

            {isAdmin && (
              <Controller
                control={formMethods.control}
                name="adminComment"
                render={({ field }) => (
                  <div className="w-[640px]">
                    <Input
                      label="Commentaire interne (optionnel)"
                      hintText="Visible uniquement par les administrateurs"
                      textArea
                      nativeTextAreaProps={{
                        value: field.value ?? "",
                        onChange: (e) => field.onChange(e.target.value || null),
                        rows: 4,
                      }}
                    />
                  </div>
                )}
              />
            )}

            <div>
              <Button
                type="button"
                priority="tertiary"
                iconId="ri-delete-bin-line"
                onClick={() => deleteModal.open()}
              >
                Supprimer l&apos;équipe
              </Button>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isPending}
                iconId="ri-save-line"
                size="large"
              >
                Enregistrer les modifications
              </Button>
            </div>
          </div>
        </form>
      </div>

      <deleteModal.Component
        title="Supprimer l'équipe"
        buttons={[
          {
            doClosesModal: true,
            children: "Annuler",
          },
          {
            doClosesModal: false,
            children: isDeleting ? "Suppression..." : "Supprimer",
            onClick: handleDeleteTeam,
            priority: "primary",
          },
        ]}
      >
        <p>
          Êtes-vous sûr de vouloir supprimer l&apos;équipe{" "}
          <strong>{team.name}</strong> ?
        </p>
        <p className="mt-2 text-[#666]">
          Cette action est irréversible. Tous les membres seront retirés de
          l&apos;équipe.
        </p>
        <TeamDeletionPreview teamId={teamId} />
      </deleteModal.Component>
    </div>
  );
}
