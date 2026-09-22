"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { useRef, useState } from "react";
import { useFocusOnVisible } from "@/app/hooks/use-focus-on-visible";
import Button from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import {
  teamAcceptTypesSchema,
  TeamAcceptTypesFormValues,
} from "../team-settings-schema";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { USER_ROLES } from "@/constants/user-roles";
import { TeamType } from "@/generated/prisma/enums";
import {
  ACCEPT_TYPE_LABELS,
  ACCEPT_TYPE_HINTS,
  ACCEPT_TYPES_ORDER,
} from "@/constants/team-types";

const ALL_TEAM_TYPES = Object.values(TeamType);

export function TeamAcceptTypes({ teamId }: { teamId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const currentUser = useSession();
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const alertRef = useFocusOnVisible(showSuccessAlert);

  const { data: team } = useQuery(trpc.team.getTeamById.queryOptions(teamId));
  const isManager = team?.managers?.some(
    (manager) => manager.id === currentUser.data?.user?.id,
  );
  const isAdmin = currentUser.data?.user?.role === USER_ROLES.ADMIN;
  const isSupervisor = currentUser.data?.user?.role === USER_ROLES.SUPERVISOR;

  const formMethods = useForm<TeamAcceptTypesFormValues>({
    resolver: zodResolver(teamAcceptTypesSchema),
    defaultValues: {
      acceptTypes: ALL_TEAM_TYPES,
    },
    mode: "onSubmit",
  });

  const lastTeamIdRef = useRef<string | null>(null);

  if (team && team.id !== lastTeamIdRef.current) {
    formMethods.reset({
      acceptTypes: team.acceptTypes ?? ALL_TEAM_TYPES,
    });
    lastTeamIdRef.current = team.id;
  }

  const { mutateAsync: updateAcceptTypes, isPending } = useMutation(
    trpc.team.updateTeamAcceptTypes.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries(
          trpc.team.getTeamById.queryOptions(teamId),
        );
        const updatedTeam = queryClient.getQueryData<typeof team>(
          trpc.team.getTeamById.queryOptions(teamId).queryKey,
        );
        if (updatedTeam) {
          formMethods.reset({
            acceptTypes: updatedTeam.acceptTypes ?? ALL_TEAM_TYPES,
          });
        }
        setShowSuccessAlert(true);
      },
    }),
  );

  async function onSubmit(data: TeamAcceptTypesFormValues) {
    setShowSuccessAlert(false);
    try {
      await updateAcceptTypes({
        id: teamId,
        acceptTypes: data.acceptTypes,
      });
    } catch (error) {
      console.error("Error updating team accept types:", error);
    }
  }

  if (!isManager && !isAdmin && !isSupervisor) {
    return null;
  }

  if (!team || team.role !== "OPERATOR") {
    return null;
  }

  return (
    <div className="p-4 md:p-20 bg-white relative mt-5">
      <div className="flex flex-col gap-4">
        <h2>Interlocuteurs de l&apos;équipe</h2>

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

        <Alert
          severity="info"
          small
          description={
            <>
              Choisissez à quels types d’organismes votre équipe peut répondre.
              Il est fortement recommandé de consulter{" "}
              <a
                target="_blank"
                href="https://docs.aplus.beta.gouv.fr/vous-etes-responsable-dequipe/choisir-les-interlocuteurs-de-ses-equipes-destinataires"
              >
                la page d&apos;information sur les types d&apos;aidants
                <span className="sr-only"> - nouvelle fenêtre</span>
              </a>
              , ainsi que de contacter le support, avant d’effectuer des
              changements dans ce menu.
            </>
          }
        />

        <form onSubmit={formMethods.handleSubmit(onSubmit)}>
          <div className="flex flex-col mt-6">
            <Controller
              control={formMethods.control}
              name="acceptTypes"
              render={({ field }) => (
                <Checkbox
                  legend="L'équipe répond aux signalements :"
                  state={
                    formMethods.formState.errors.acceptTypes
                      ? "error"
                      : "default"
                  }
                  stateRelatedMessage={
                    formMethods.formState.errors.acceptTypes?.message as string
                  }
                  options={ACCEPT_TYPES_ORDER.map((type) => ({
                    label: (
                      <>
                        <span className="sr-only">
                          L&apos;équipe répond aux signalements{" "}
                        </span>
                        {ACCEPT_TYPE_LABELS[type]}
                      </>
                    ),
                    hintText: ACCEPT_TYPE_HINTS[type],
                    nativeInputProps: {
                      name: "acceptTypes",
                      value: type,
                      checked: field.value?.includes(type) ?? false,
                      onChange: (
                        event: React.ChangeEvent<HTMLInputElement>,
                      ) => {
                        const checked = event.target.checked;
                        const currentValue = field.value ?? [];
                        if (checked) {
                          field.onChange([...currentValue, type]);
                        } else {
                          field.onChange(
                            currentValue.filter((t) => t !== type),
                          );
                        }
                      },
                    },
                  }))}
                />
              )}
            />

            <div className="flex justify-end mt-8">
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
    </div>
  );
}
