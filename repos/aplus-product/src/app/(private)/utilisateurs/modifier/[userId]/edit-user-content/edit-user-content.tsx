"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import Button from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import Input from "@codegouvfr/react-dsfr/Input";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { z } from "zod";
import { ROUTE } from "@/app/constant/route";
import Tag from "@codegouvfr/react-dsfr/Tag";
import { MultiSelectAutocomplete } from "@/app/component/multi-select-autocomplete/multi-select-autocomplete";
import { admin } from "@/lib/auth-client";
import { useAnalytics } from "@/app/hooks/use-analytics";
import { USER_ROLES } from "@/constants/user-roles";
import { DeactivateUserButton } from "@/app/(private)/utilisateurs/components/deactivate-user-button/deactivate-user-button";
import { ReactivateUserButton } from "@/app/(private)/utilisateurs/components/reactivate-user-button/reactivate-user-button";
import { RemovalDebugPreview } from "@/app/(private)/equipes/[id]/components/team-content/team-content-columns/team-content-columns";
import { TransformToSupervisorSection } from "@/app/(private)/utilisateurs/modifier/[userId]/transform-to-supervisor-section/transform-to-supervisor-section";
import { UserAnalyticsSection } from "./components/user-analytics-section/user-analytics-section";

const editUserSchema = z.object({
  email: z
    .string()
    .min(1, { message: "L'adresse e-mail est obligatoire." })
    .email({ message: "L'adresse e-mail n'est pas valide." }),
  firstName: z.string().min(1, {
    message: "Veuillez saisir votre prénom.",
  }),
  lastName: z.string().min(1, {
    message: "Veuillez saisir votre nom.",
  }),
  phone: z.string().optional().nullable(),
  profession: z.string().optional().nullable(),
  teamIds: z.array(z.string()),
  areaIds: z.array(z.string()),
  organizationIds: z.array(z.string()),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

// Libellé d'une organisation : « Nom (Sigle) » si un sigle distinct existe.
function getOrgLabel(org: { name: string; shortName: string | null }) {
  return org.shortName && org.shortName !== org.name
    ? `${org.name} (${org.shortName})`
    : org.name;
}

interface EditUserContentProps {
  userId: string;
}

export function EditUserContent({ userId }: EditUserContentProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { track, flush } = useAnalytics();

  // Données déjà prefetch côté serveur - pas de loading state
  const { data: user } = useQuery(
    trpc.user.getFullUserById.queryOptions(userId),
  );
  const { data: currentUser } = useQuery(
    trpc.user.getCurrentUser.queryOptions(),
  );

  const isCurrentUser = currentUser?.id === userId;
  const isAdmin = currentUser?.role === USER_ROLES.ADMIN;

  const { data: allTeams } = useQuery({
    ...trpc.team.getTeams.queryOptions(),
    enabled: isAdmin,
  });

  const isSupervisor = user?.role === USER_ROLES.SUPERVISOR;
  const showSupervisorSection = isAdmin && isSupervisor;

  const { data: allAreas } = useQuery({
    ...trpc.area.getAreas.queryOptions(),
    enabled: showSupervisorSection,
  });
  const { data: allOrganizations } = useQuery({
    ...trpc.organization.getOrganizations.queryOptions(),
    enabled: showSupervisorSection,
  });

  const sortedOrganizations = useMemo(
    () =>
      allOrganizations
        ? [...allOrganizations].sort((a, b) => a.name.localeCompare(b.name))
        : undefined,
    [allOrganizations],
  );

  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [pendingFormData, setPendingFormData] =
    useState<EditUserFormValues | null>(null);
  const [removedTeamNames, setRemovedTeamNames] = useState<string[]>([]);
  const [removedTeamIds, setRemovedTeamIds] = useState<string[]>([]);

  const confirmTeamRemovalModal = useMemo(
    () =>
      createModal({
        id: `confirm-team-removal-${userId}`,
        isOpenedByDefault: false,
      }),
    [userId],
  );

  const formMethods = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      profession: "",
      teamIds: [],
      areaIds: [],
      organizationIds: [],
    },
    mode: "onSubmit",
  });

  const lastUserSnapshotRef = useRef<string | null>(null);

  // Reset form when user data loads or when role/teams/supervisor scope change
  // (e.g. after transforming a user into a supervisor — id stays the same).
  const userSnapshot = user
    ? [
        user.id,
        user.role,
        user.teams.map((t) => t.id).join(","),
        user.supervisor?.areas.map((a) => a.id).join(",") ?? "",
        user.supervisor?.organizations.map((o) => o.id).join(",") ?? "",
      ].join("|")
    : null;

  if (user && userSnapshot !== lastUserSnapshotRef.current) {
    formMethods.reset({
      email: user.email ?? "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      phone: user.phone ?? "",
      profession: user.profession ?? "",
      teamIds: user.teams.map((t) => t.id),
      areaIds: user.supervisor?.areas.map((a) => a.id) ?? [],
      organizationIds: user.supervisor?.organizations.map((o) => o.id) ?? [],
    });
    lastUserSnapshotRef.current = userSnapshot;
  }

  const { mutateAsync: updateUser, isPending: isUpdating } = useMutation(
    trpc.user.updateUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries(
          trpc.user.getFullUserById.queryOptions(userId),
        );
        setShowSuccessAlert(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    }),
  );

  const { mutateAsync: updateSupervisor } = useMutation(
    trpc.supervisor.updateSupervisor.mutationOptions(),
  );

  const { mutateAsync: deactivateUser } = useMutation(
    trpc.user.deactivateUser.mutationOptions({
      onSuccess: async () => {
        // Don't refetch user data after deactivation - the user is removed from teams
        // and the current user may no longer have authorization to view them
        await queryClient.invalidateQueries(trpc.user.getUsers.queryOptions());
        router.push(ROUTE.USERS);
      },
    }),
  );

  const { mutateAsync: reactivateUser } = useMutation(
    trpc.user.reactivateUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries(
          trpc.user.getFullUserById.queryOptions(userId),
        );
      },
    }),
  );

  async function onSubmit(data: EditUserFormValues) {
    setShowSuccessAlert(false);
    try {
      if (showSupervisorSection) {
        await updateSupervisor({
          userId,
          areaIds: data.areaIds,
          organizationIds: data.organizationIds,
        });
      }
      await updateUser({
        userId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone === "" ? null : data.phone,
        profession: data.profession === "" ? null : data.profession,
        teamIds: data.teamIds,
      });
    } catch (error) {
      console.error("Error updating user:", error);
    }
  }

  function handleBeforeSubmit(data: EditUserFormValues) {
    if (!user) return;

    const newTeamIds = new Set(data.teamIds);
    const removed = user.teams.filter((t) => !newTeamIds.has(t.id));

    if (removed.length > 0) {
      setPendingFormData(data);
      setRemovedTeamNames(removed.map((t) => t.name));
      setRemovedTeamIds(removed.map((t) => t.id));
      confirmTeamRemovalModal.open();
    } else {
      onSubmit(data);
    }
  }

  async function handleDeactivate(targetUserId: string) {
    await deactivateUser({ userId: targetUserId });
  }

  async function handleReactivate(targetUserId: string) {
    await reactivateUser({ userId: targetUserId });
  }

  if (!user) {
    return null;
  }

  const isUserInactive = user.isInactive !== null;

  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <>
      <h1>{fullName}</h1>

      {showSuccessAlert && (
        <Alert
          severity="success"
          role="status"
          title="Les modifications ont bien été enregistrées."
          closable
          onClose={() => setShowSuccessAlert(false)}
          className="mb-4"
        />
      )}

      <FormProvider {...formMethods}>
        <form onSubmit={formMethods.handleSubmit(handleBeforeSubmit)}>
          <div className="bg-white p-4 md:p-20 mb-8">
            {/* Section: Informations personnelles */}
            <section className="flex flex-col gap-4">
              {isUserInactive && (
                <Badge severity="error" noIcon className="self-start">
                  DÉSACTIVÉ
                </Badge>
              )}
              <h2>Informations personnelles</h2>

              <div className="flex flex-col gap-4 max-w-[320px]">
                <Controller
                  control={formMethods.control}
                  name="email"
                  render={({ field }) => (
                    <Input
                      state={
                        formMethods.formState.errors.email ? "error" : "default"
                      }
                      stateRelatedMessage={
                        formMethods.formState.errors.email?.message
                      }
                      label="Adresse e-mail"
                      disabled={isUserInactive}
                      nativeInputProps={{
                        type: "email",
                        "aria-required": true,
                        value: field.value ?? "",
                        onChange: (e) => {
                          field.onChange(e.target.value);
                        },
                      }}
                    />
                  )}
                />

                <Controller
                  control={formMethods.control}
                  name="firstName"
                  render={({ field }) => (
                    <Input
                      state={
                        formMethods.formState.errors.firstName
                          ? "error"
                          : "default"
                      }
                      stateRelatedMessage={
                        formMethods.formState.errors.firstName?.message
                      }
                      label="Prénom"
                      disabled={isUserInactive}
                      nativeInputProps={{
                        "aria-required": true,
                        value: field.value ?? "",
                        onChange: (e) => {
                          field.onChange(e.target.value);
                        },
                      }}
                    />
                  )}
                />

                <Controller
                  control={formMethods.control}
                  name="lastName"
                  render={({ field }) => (
                    <Input
                      state={
                        formMethods.formState.errors.lastName
                          ? "error"
                          : "default"
                      }
                      stateRelatedMessage={
                        formMethods.formState.errors.lastName?.message
                      }
                      label="Nom"
                      disabled={isUserInactive}
                      nativeInputProps={{
                        "aria-required": true,
                        value: field.value ?? "",
                        onChange: (e) => {
                          field.onChange(e.target.value);
                        },
                      }}
                    />
                  )}
                />

                <Controller
                  control={formMethods.control}
                  name="profession"
                  render={({ field }) => (
                    <Input
                      state={
                        formMethods.formState.errors.profession
                          ? "error"
                          : "default"
                      }
                      stateRelatedMessage={
                        formMethods.formState.errors.profession?.message
                      }
                      label="Profession (optionnel)"
                      disabled={isUserInactive}
                      nativeInputProps={{
                        value: field.value ?? "",
                        onChange: (e) => {
                          field.onChange(e.target.value);
                        },
                      }}
                    />
                  )}
                />

                <Controller
                  control={formMethods.control}
                  name="phone"
                  render={({ field }) => (
                    <Input
                      state={
                        formMethods.formState.errors.phone ? "error" : "default"
                      }
                      stateRelatedMessage={
                        formMethods.formState.errors.phone?.message
                      }
                      label="Numéro de téléphone (optionnel)"
                      disabled={isUserInactive}
                      nativeInputProps={{
                        type: "tel",
                        value: field.value ?? "",
                        onChange: (e) => {
                          field.onChange(e.target.value);
                        },
                      }}
                    />
                  )}
                />
              </div>
            </section>
          </div>

          {!isSupervisor && (
            <div className="bg-white p-4 md:p-20 mb-8">
              {/* Section: Équipe(s) */}
              <section className="flex flex-col">
                <h2>Équipe(s)</h2>
                <div className="flex flex-col gap-4">
                  {isAdmin ? (
                    <Controller
                      control={formMethods.control}
                      name="teamIds"
                      render={({ field }) => (
                        <div className="flex flex-col gap-4">
                          <div className="w-1/2">
                            <MultiSelectAutocomplete
                              id="edit-user-teams"
                              label="Équipe(s)"
                              placeholder="Choisissez une ou plusieurs équipes"
                              options={allTeams ?? []}
                              value={field.value}
                              onChange={field.onChange}
                              getOptionLabel={(option) => option.name}
                              noOptionsText="Aucune équipe trouvée"
                              selectAll={false}
                              disabled={isUserInactive}
                              chipsContainerAriaLabel="Équipes sélectionnées"
                              getChipButtonProps={() => ({
                                disabled: isUserInactive,
                              })}
                            />
                          </div>
                          {field.value.length === 0 && (
                            <p className="text-[#666] italic">Aucune équipe</p>
                          )}
                        </div>
                      )}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-4">
                      {user.teams.length > 0 ? (
                        user.teams.map((team) => (
                          <Tag
                            key={team.id}
                            nativeButtonProps={{
                              onClick: () =>
                                router.push(`${ROUTE.TEAMS}/${team.id}`),
                            }}
                          >
                            {team.name}
                          </Tag>
                        ))
                      ) : (
                        <p className="text-[#666] italic">Aucune équipe</p>
                      )}
                    </div>
                  )}
                </div>
              </section>
              {!showSupervisorSection && (
                <div className="flex justify-end mt-8">
                  <Button
                    type="submit"
                    disabled={isUpdating}
                    iconId="ri-save-line"
                    size="large"
                  >
                    Enregistrer les modifications
                  </Button>
                </div>
              )}
            </div>
          )}

          {showSupervisorSection && (
            <div className="bg-white p-4 md:p-20 mb-8">
              {/* Section: Gestion du profil superviseur (admin only, for supervisors) */}
              <section className="flex flex-col">
                <h2>Gestion du profil superviseur</h2>
                <div className="flex flex-col gap-4">
                  <Controller
                    control={formMethods.control}
                    name="areaIds"
                    render={({ field, fieldState }) => (
                      <div className="flex flex-col gap-4">
                        <div className="w-1/2">
                          <MultiSelectAutocomplete
                            id="edit-user-areas"
                            label="Territoires à superviser"
                            placeholder="Choisissez un ou plusieurs départements"
                            options={allAreas ?? []}
                            value={field.value}
                            onChange={field.onChange}
                            getOptionLabel={(option) => option.name}
                            noOptionsText="Aucun département trouvé"
                            selectAll={false}
                            disabled={isUserInactive}
                            error={!!fieldState.error}
                            chipsContainerAriaLabel="Territoires sélectionnés"
                            getChipButtonProps={() => ({
                              disabled: isUserInactive,
                            })}
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
                      <div className="flex flex-col gap-4">
                        <div className="w-1/2">
                          <MultiSelectAutocomplete
                            id="edit-user-organizations"
                            label="Organisation à superviser"
                            placeholder="Choisissez une organisation"
                            options={sortedOrganizations ?? []}
                            value={field.value}
                            onChange={field.onChange}
                            getOptionLabel={getOrgLabel}
                            renderOptionContent={(option) => (
                              <>
                                {option.name}
                                {option.shortName &&
                                  option.shortName !== option.name && (
                                    <span className="ml-1 text-(--text-mention-grey)">
                                      ({option.shortName})
                                    </span>
                                  )}
                              </>
                            )}
                            noOptionsText="Aucune organisation trouvée"
                            selectAll={false}
                            disabled={isUserInactive}
                            error={!!fieldState.error}
                            chipsContainerAriaLabel="Organisations sélectionnées"
                            getChipButtonProps={() => ({
                              disabled: isUserInactive,
                            })}
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
                </div>
              </section>
              <div className="flex justify-end mt-8">
                <Button
                  type="submit"
                  disabled={isUpdating}
                  iconId="ri-save-line"
                  size="large"
                >
                  Enregistrer les modifications
                </Button>
              </div>
            </div>
          )}
        </form>
      </FormProvider>

      <div className="bg-white p-4 md:p-20 mb-8">
        {/* Section: Impersonification (admin only) */}
        <section className="flex flex-col">
          <h2>Impersonification</h2>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={async () => {
                try {
                  track("auth_impersonate_user", {
                    targetUserId: userId,
                    targetEmail: user.email ?? "",
                  });
                  await flush();
                  const result = await admin.impersonateUser({ userId });
                  if (result.error) {
                    console.error("Erreur d'impersonation:", result.error);
                    alert("Erreur: " + result.error.message);
                    return;
                  }
                  window.location.href = ROUTE.HOME;
                } catch (error) {
                  console.error("Erreur d'impersonation:", error);
                  alert("Erreur lors de l'impersonation");
                }
              }}
              className="inline-flex underline items-center gap-2 text-blue-primary w-fit underline-offset-2 cursor-pointer bg-transparent border-none p-0 text-left"
            >
              <span className="fr-icon-eye-line" aria-hidden="true" />
              Passer en mode &laquo;&nbsp;Aperçu de
              l&apos;utilisateur&nbsp;&raquo;
            </button>
          </div>
        </section>
      </div>

      {isAdmin && (
        <div className="bg-white p-4 md:p-20 mb-8">
          {/* Section: Activité analytics (admin only, vue support) */}
          <UserAnalyticsSection userId={userId} />
        </div>
      )}

      {isAdmin &&
        !isCurrentUser &&
        !isUserInactive &&
        user.role !== USER_ROLES.ADMIN &&
        user.role !== USER_ROLES.SUPERVISOR && (
          <div className="bg-white p-4 md:p-20 mb-8">
            <TransformToSupervisorSection
              userId={userId}
              onSuccess={() => {
                setShowSuccessAlert(true);
              }}
            />
          </div>
        )}

      {!isCurrentUser && (
        <div className="bg-white p-4 md:p-20 mb-8">
          <section className="flex flex-col">
            <h2>
              {isUserInactive
                ? "Réactiver l'utilisateur"
                : "Désactiver l'utilisateur"}
            </h2>

            {isUserInactive ? (
              <ReactivateUserButton
                userId={userId}
                onReactivateUser={handleReactivate}
                size="medium"
              />
            ) : (
              <DeactivateUserButton
                userId={userId}
                onDeactivateUser={handleDeactivate}
                size="medium"
              />
            )}
          </section>
        </div>
      )}

      <confirmTeamRemovalModal.Component
        title="Confirmer le retrait d'équipe(s)"
        buttons={[
          {
            doClosesModal: true,
            children: "Annuler",
            priority: "secondary",
          },
          {
            doClosesModal: false,
            children: "Confirmer les modifications",
            onClick: async () => {
              if (pendingFormData) {
                confirmTeamRemovalModal.close();
                await onSubmit(pendingFormData);
                setPendingFormData(null);
              }
            },
          },
        ]}
      >
        <p>
          L&apos;utilisateur sera retiré de {removedTeamNames.length} équipe(s)
          : <strong>{removedTeamNames.join(", ")}</strong>.
        </p>
        <p>
          Les signalements dont <strong>{user.email}</strong> est auteur ou
          destinataire au sein de cette/ces équipe(s) seront réaffectés ou
          clôturés automatiquement.
        </p>
        {process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === "true" &&
          removedTeamIds.map((teamId) => (
            <RemovalDebugPreview key={teamId} userId={userId} teamId={teamId} />
          ))}
      </confirmTeamRemovalModal.Component>
    </>
  );
}
