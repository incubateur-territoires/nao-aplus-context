import { Controller, useFormContext } from "react-hook-form";
import Input from "@codegouvfr/react-dsfr/Input";
import { ProfileFormValues } from "../profile-schema";

export function PersonalInformationForm() {
  const formMethods = useFormContext<ProfileFormValues>();

  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-[32px] font-bold leading-[40px] text-[#161616]">
        Informations personnelles
      </h2>
      <p className="text-base text-[#161616]">
        Tous les champs sont obligatoires sauf mention contraire.
      </p>

      <div className="flex flex-col gap-4">
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
              {...field}
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
              {...field}
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
                formMethods.formState.errors.profession ? "error" : "default"
              }
              stateRelatedMessage={
                formMethods.formState.errors.profession?.message
              }
              label="Profession (optionnel)"
              {...field}
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
              stateRelatedMessage={formMethods.formState.errors.phone?.message}
              label="Numéro de téléphone (optionnel)"
              {...field}
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
  );
}
