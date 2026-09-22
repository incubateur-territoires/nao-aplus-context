"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { useRef, useState } from "react";
import { useFocusOnVisible } from "@/app/hooks/use-focus-on-visible";
import Button from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { TeamSettingsForm } from "../team-settings-form/team-settings-form";
import {
  teamSettingsSchema,
  TeamSettingsFormValues,
} from "../team-settings-schema";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { USER_ROLES } from "@/constants/user-roles";

export function TeamSettings({ teamId }: { teamId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const currentUser = useSession();
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const alertRef = useFocusOnVisible(showSuccessAlert);

  // Données déjà prefetch côté serveur - pas de loading state
  const { data: team } = useQuery(trpc.team.getTeamById.queryOptions(teamId));
  const isManager = team?.managers?.some(
    (manager) => manager.id === currentUser.data?.user?.id,
  );
  const isAdmin = currentUser.data?.user?.role === USER_ROLES.ADMIN;
  const isSupervisor = currentUser.data?.user?.role === USER_ROLES.SUPERVISOR;

  const formMethods = useForm<TeamSettingsFormValues>({
    resolver: zodResolver(teamSettingsSchema),
    defaultValues: {
      name: "",
      email: null,
      description: null,
    },
    mode: "onSubmit",
  });

  const lastTeamIdRef = useRef<string | null>(null);

  // Reset form when team data loads or changes
  if (team && team.id !== lastTeamIdRef.current) {
    formMethods.reset({
      name: team.name ?? "",
      email: team.email ?? null,
      description: team.description ?? null,
    });
    lastTeamIdRef.current = team.id;
  }

  const { mutateAsync: updateTeam, isPending } = useMutation(
    trpc.team.updateTeam.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries(
          trpc.team.getTeamById.queryOptions(teamId),
        );
        const updatedTeam = queryClient.getQueryData<typeof team>(
          trpc.team.getTeamById.queryOptions(teamId).queryKey,
        );
        if (updatedTeam) {
          formMethods.reset({
            name: updatedTeam.name ?? "",
            email: updatedTeam.email ?? null,
            description: updatedTeam.description ?? null,
          });
        }
        setShowSuccessAlert(true);
      },
    }),
  );

  async function onSubmit(data: TeamSettingsFormValues) {
    setShowSuccessAlert(false);
    try {
      await updateTeam({
        id: teamId,
        name: data.name,
        email: data.email ?? null,
        description: data.description ?? null,
      });
    } catch (error) {
      console.error("Error updating team:", error);
    }
  }

  if (!isManager && !isAdmin && !isSupervisor) {
    return null;
  }

  if (!team) {
    return null;
  }

  return (
    <div className="p-4 md:p-20 bg-white relative mt-5">
      <div className="flex flex-col gap-4">
        <h2>Informations de l&apos;équipe</h2>

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

        <FormProvider {...formMethods}>
          {/* noValidate : on délègue toute la validation à zod + DSFR. Sans cela,
              la validation native du navigateur (type="email") afficherait sa
              propre bulle et court-circuiterait les messages d'erreur DSFR. */}
          <form onSubmit={formMethods.handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col">
              <TeamSettingsForm />

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
        </FormProvider>
      </div>
    </div>
  );
}
