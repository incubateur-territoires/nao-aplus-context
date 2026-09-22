"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useTRPC } from "@/trpc/client";
import { MultiSelectAutocomplete } from "@/app/component/multi-select-autocomplete/multi-select-autocomplete";

// Libellé d'une organisation : « Nom (Sigle) » si un sigle distinct existe.
function getOrgLabel(org: { name: string; shortName: string | null }) {
  return org.shortName && org.shortName !== org.name
    ? `${org.name} (${org.shortName})`
    : org.name;
}

const transformSchema = z
  .object({
    areaIds: z.array(z.string()),
    organizationIds: z.array(z.string()),
  })
  .refine((d) => d.areaIds.length + d.organizationIds.length > 0, {
    message: "Sélectionnez au moins un territoire ou une organisation.",
    path: ["areaIds"],
  });

type TransformFormValues = z.infer<typeof transformSchema>;

interface TransformToSupervisorSectionProps {
  userId: string;
  onSuccess: () => void;
}

const SCENARIO_LABELS: Record<string, string> = {
  AUTHOR_TRANSFER: "Transféré à un autre membre de l'équipe",
  AUTHOR_WITH_COAUTHORS: "Co-auteurs notifiés",
  AUTHOR_ALONE_CLOSE: "Fermé (auteur seul sans équipe)",
  COAUTHOR_ONLY: "Retiré des co-auteurs",
  RECIPIENT_ALONE_CLOSE: "Fermé (destinataire seul)",
  RECIPIENT_HANDLED_REVERT: "Remis en attente de prise en charge",
  RECIPIENT_NOT_HANDLED: "Destinataires notifiés",
};

export function TransformToSupervisorSection({
  userId,
  onSuccess,
}: TransformToSupervisorSectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: allAreas } = useQuery(trpc.area.getAreas.queryOptions());
  const { data: allOrganizations } = useQuery(
    trpc.organization.getOrganizations.queryOptions(),
  );

  const sortedOrganizations = useMemo(
    () =>
      allOrganizations
        ? [...allOrganizations].sort((a, b) => a.name.localeCompare(b.name))
        : undefined,
    [allOrganizations],
  );

  const formMethods = useForm<TransformFormValues>({
    resolver: zodResolver(transformSchema),
    defaultValues: {
      areaIds: [],
      organizationIds: [],
    },
    mode: "onSubmit",
  });

  const confirmModal = useMemo(
    () =>
      createModal({
        id: `confirm-transform-supervisor-${userId}`,
        isOpenedByDefault: false,
      }),
    [userId],
  );

  const { mutateAsync: transformToSupervisor, isPending } = useMutation(
    trpc.user.transformToSupervisor.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries(
          trpc.user.getFullUserById.queryOptions(userId),
        );
        onSuccess();
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    }),
  );

  function handleOpenConfirm() {
    confirmModal.open();
  }

  async function handleConfirm() {
    const values = formMethods.getValues();
    confirmModal.close();
    await transformToSupervisor({
      userId,
      areaIds: values.areaIds,
      organizationIds: values.organizationIds,
    });
  }

  return (
    <section className="flex flex-col">
      <h2>Transformer l&apos;utilisateur en superviseur</h2>
      <p className="mb-4">
        Si le membre est auteur de signalements, ces signalements seront
        transférés à d&apos;autres membres de l&apos;équipe. Si le membre a
        participé à des conversations, les autres participants seront avertis de
        son retrait.
      </p>
      <p className="mb-6">
        Le{" "}
        <a
          href="https://docs.aplus.beta.gouv.fr/comprendre-administration-plus/lexique-glossaire#superviseur"
          target="_blank"
          rel="noreferrer"
        >
          superviseur
        </a>{" "}
        a accès à tous les signalements des territoires qui le concernent, mais
        il n&apos;a pas accès à leur contenu.
      </p>

      <FormProvider {...formMethods}>
        <form onSubmit={formMethods.handleSubmit(handleOpenConfirm)}>
          <div className="flex flex-col gap-4">
            <Controller
              control={formMethods.control}
              name="areaIds"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-4">
                  <div className="w-1/2">
                    <MultiSelectAutocomplete
                      id="transform-areas"
                      label="Territoires à superviser"
                      placeholder="Choisissez un ou plusieurs départements"
                      options={allAreas ?? []}
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
                <div className="flex flex-col gap-4">
                  <div className="w-1/2">
                    <MultiSelectAutocomplete
                      id="transform-organizations"
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

            <div className="flex justify-end mt-4">
              <Button
                type="submit"
                disabled={isPending}
                iconId="ri-user-star-line"
                size="large"
              >
                Transformer l&apos;utilisateur en superviseur
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>

      <confirmModal.Component
        title="Transformer l'utilisateur en superviseur"
        buttons={[
          {
            doClosesModal: true,
            children: "Annuler",
            priority: "secondary",
          },
          {
            doClosesModal: false,
            children: "Confirmer la transformation",
            onClick: handleConfirm,
          },
        ]}
      >
        <p>
          L&apos;utilisateur sera retiré de toutes ses équipes et son rôle sera
          changé en <strong>superviseur</strong>. Cette action invalide ses
          sessions actives.
        </p>
        <SupervisorTransformationPreview userId={userId} />
      </confirmModal.Component>
    </section>
  );
}

function SupervisorTransformationPreview({ userId }: { userId: string }) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.user.previewSupervisorTransformation.queryOptions({ userId }),
  );

  if (isLoading) {
    return (
      <div style={{ marginTop: 16, padding: 8, background: "#f5f5f5" }}>
        Chargement de l&apos;aperçu...
      </div>
    );
  }

  if (!data) return null;

  const transferCount = data.scenarios.filter(
    (s) => s.type === "AUTHOR_TRANSFER",
  ).length;
  const closeCount = data.scenarios.filter(
    (s) =>
      s.type === "AUTHOR_ALONE_CLOSE" || s.type === "RECIPIENT_ALONE_CLOSE",
  ).length;
  const notificationCount = data.scenarios.filter(
    (s) =>
      s.type === "COAUTHOR_ONLY" ||
      s.type === "AUTHOR_WITH_COAUTHORS" ||
      s.type === "RECIPIENT_NOT_HANDLED",
  ).length;
  const revertCount = data.scenarios.filter(
    (s) => s.type === "RECIPIENT_HANDLED_REVERT",
  ).length;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        background: "#f5f5fe",
        border: "1px solid #c4c4f7",
        borderRadius: 4,
      }}
    >
      <h3 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
        Aperçu des impacts
      </h3>
      <div style={{ marginTop: 12, fontSize: 14 }}>
        {data.teams.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Équipes (sera retiré de) :
            </h4>
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
              {data.teams.map((team, i) => (
                <li key={i}>{team}</li>
              ))}
            </ul>
          </div>
        )}

        {data.managedTeams.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Équipes gérées (ne sera plus responsable) :
            </h4>
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
              {data.managedTeams.map((team, i) => {
                const transfer = data.managerTransfers?.find(
                  (t) => t.teamName === team,
                );
                return (
                  <li key={i}>
                    {team}
                    {transfer?.hasOtherManagers && (
                      <span style={{ color: "#666" }}>
                        {" "}
                        — d&apos;autres responsables existent
                      </span>
                    )}
                    {transfer &&
                      !transfer.hasOtherManagers &&
                      transfer.newManagerName && (
                        <span style={{ color: "#2e7d32" }}>
                          {" "}
                          → transféré à{" "}
                          <strong>{transfer.newManagerName}</strong>
                        </span>
                      )}
                    {transfer &&
                      !transfer.hasOtherManagers &&
                      !transfer.newManagerName && (
                        <span style={{ color: "#d32f2f" }}>
                          {" "}
                          ⚠ aucun membre actif pour reprendre le rôle
                        </span>
                      )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {data.scenarios.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Résumé des impacts sur les signalements :
            </h4>
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
              {transferCount > 0 && (
                <li>
                  {transferCount} signalement(s) transféré(s) à un autre membre
                  de l&apos;équipe
                </li>
              )}
              {closeCount > 0 && <li>{closeCount} signalement(s) fermé(s)</li>}
              {notificationCount > 0 && (
                <li>{notificationCount} notification(s) envoyée(s)</li>
              )}
              {revertCount > 0 && (
                <li>
                  {revertCount} signalement(s) remis en attente de prise en
                  charge
                </li>
              )}
            </ul>
          </div>
        )}

        {data.scenarios.length > 0 && (
          <div>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Détail par signalement :
            </h4>
            <div
              style={{
                marginTop: 8,
                maxHeight: 200,
                overflow: "auto",
                background: "#fff",
                padding: 8,
                borderRadius: 4,
              }}
            >
              {data.scenarios.map((scenario, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 0",
                    borderBottom:
                      i < data.scenarios.length - 1 ? "1px solid #eee" : "none",
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
                    {scenario.reportSubject}
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Usager : {scenario.reportApplicant}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 4,
                      color: "#000091",
                    }}
                  >
                    → {SCENARIO_LABELS[scenario.type] || scenario.type}
                    {scenario.type === "AUTHOR_TRANSFER" &&
                      "newAuthor" in scenario && (
                        <span style={{ color: "#333" }}>
                          {" "}
                          vers <strong>{scenario.newAuthor}</strong>
                        </span>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.scenarios.length === 0 && data.teams.length === 0 && (
          <div style={{ fontStyle: "italic", color: "#666" }}>
            Aucun impact : l&apos;utilisateur n&apos;est dans aucune équipe et
            n&apos;a aucun signalement actif.
          </div>
        )}
      </div>
    </div>
  );
}
