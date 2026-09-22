"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import Button from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import Input from "@codegouvfr/react-dsfr/Input";
import { getSafeReturnTo } from "@/utils/return-to";
import {
  completeProfileSchema,
  type CompleteProfileFormValues,
} from "../complete-profile-schema";
import Image from "next/image";

export function CompleteProfileContent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const formMethods = useForm<CompleteProfileFormValues>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      profession: "",
    },
    mode: "onSubmit",
  });

  const { mutateAsync: updateProfile, isPending } = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["session"] });
        await queryClient.refetchQueries(
          trpc.user.getCurrentUser.queryOptions(),
        );
        const returnTo = new URLSearchParams(window.location.search).get(
          "returnTo",
        );
        router.replace(getSafeReturnTo(returnTo));
        router.refresh();
      },
    }),
  );

  async function onSubmit(data: CompleteProfileFormValues) {
    try {
      await updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone === "" ? null : data.phone,
        profession: data.profession === "" ? null : data.profession,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  }

  return (
    <div className="fixed inset-0 z-9999 flex flex-col items-center overflow-auto pt-12 px-2.5 bg-(--background-alt-blue-france)">
      <div className="w-full max-w-[640px]">
        <h1 className="fr-h3 fr-mb-4w">Profil incomplet</h1>
      </div>

      <div className="w-full max-w-[640px] bg-(--background-default-grey) p-20">
        <Alert
          severity="error"
          title="Votre profil A+ est incomplet"
          description="Certaines informations requises sont manquantes. Merci de saisir au moins vos noms et prénoms."
          className="fr-mb-4w"
        />

        <div className="flex items-center gap-4 mb-8">
          <Image
            width={80}
            height={80}
            src="/assets/logo/a+.svg"
            alt="Logo Administration+"
          />
          <div>
            <p className="fr-text--bold fr-mb-0">Administration+</p>
            <p className="fr-mb-0 text-sm text-(--text-mention-grey)">
              Résoudre les blocages administratifs complexes ou urgents
            </p>
          </div>
        </div>

        <h2 className="fr-h5 fr-mb-1w">Informations personnelles</h2>
        <p className="fr-text--sm fr-mb-3w text-(--text-mention-grey)">
          Tous les champs sont obligatoires sauf mention contraire.
        </p>

        <form onSubmit={formMethods.handleSubmit(onSubmit)}>
          <Controller
            control={formMethods.control}
            name="firstName"
            render={({ field }) => (
              <Input
                state={
                  formMethods.formState.errors.firstName ? "error" : "default"
                }
                stateRelatedMessage={
                  formMethods.formState.errors.firstName?.message
                }
                label="Prénom"
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
                  formMethods.formState.errors.lastName ? "error" : "default"
                }
                stateRelatedMessage={
                  formMethods.formState.errors.lastName?.message
                }
                label="Nom"
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
                label="Profession (optionnel)"
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
                state={formMethods.formState.errors.phone ? "error" : "default"}
                stateRelatedMessage={
                  formMethods.formState.errors.phone?.message
                }
                label="Numéro de téléphone (optionnel)"
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

          <div className="flex justify-end mt-8">
            <Button type="submit" disabled={isPending} size="large">
              Compléter le profil et accéder à A+
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
