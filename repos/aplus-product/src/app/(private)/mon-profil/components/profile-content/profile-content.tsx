"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { useRef, useState } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { scrollToFirstError } from "@/app/component/request-form/utils/scroll";
import { EmailSection } from "./email-section/email-section";
import { PersonalInformationForm } from "./personal-information-form/personal-information-form";
import { NotificationsSection } from "./notifications-section/notifications-section";
import { TeamsSection } from "./teams-section/teams-section";
import { profileSchema, ProfileFormValues } from "./profile-schema";
import { NotificationFrequency } from "@/generated/prisma/enums";

export function ProfileContent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  const { data: user, isLoading } = useQuery(
    trpc.user.getCurrentUser.queryOptions(),
  );

  const formMethods = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      profession: "",
      notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
    },
    mode: "onSubmit",
  });

  const lastUserIdRef = useRef<string | null>(null);

  // Reset form when user data loads or changes
  if (user && user.id !== lastUserIdRef.current) {
    formMethods.reset({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      phone: user.phone ?? "",
      profession: user.profession ?? "",
      notificationFrequency:
        user.notificationFrequency ?? NotificationFrequency.EACH_SOLICITATION,
    });
    lastUserIdRef.current = user.id;
  }

  const { mutateAsync: updateProfile, isPending } = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries(
          trpc.user.getCurrentUser.queryOptions(),
        );
        const updatedUser = queryClient.getQueryData<typeof user>(
          trpc.user.getCurrentUser.queryOptions().queryKey,
        );
        if (updatedUser) {
          formMethods.reset({
            firstName: updatedUser.firstName ?? "",
            lastName: updatedUser.lastName ?? "",
            phone: updatedUser.phone ?? "",
            profession: updatedUser.profession ?? "",
            notificationFrequency:
              updatedUser.notificationFrequency ??
              NotificationFrequency.EACH_SOLICITATION,
          });
        }
        setShowSuccessAlert(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    }),
  );

  async function onSubmit(data: ProfileFormValues) {
    setShowSuccessAlert(false);
    try {
      await updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone === "" ? null : data.phone,
        profession: data.profession === "" ? null : data.profession,
        notificationFrequency: data.notificationFrequency,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  }

  if (isLoading) {
    return <div role="status">Chargement...</div>;
  }

  if (!user) {
    return <div>Utilisateur non trouvé.</div>;
  }

  return (
    <div className="bg-white p-20 mb-8">
      <FormProvider {...formMethods}>
        <form onSubmit={formMethods.handleSubmit(onSubmit, scrollToFirstError)}>
          <div className="flex flex-col gap-16">
            {showSuccessAlert && (
              <Alert
                severity="success"
                role="status"
                title="Les modifications ont bien été enregistrées."
                closable
                onClose={() => setShowSuccessAlert(false)}
              />
            )}

            <EmailSection email={user.email} />

            <PersonalInformationForm />

            <NotificationsSection />

            <TeamsSection teams={user.teams || []} />

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
      </FormProvider>
    </div>
  );
}
