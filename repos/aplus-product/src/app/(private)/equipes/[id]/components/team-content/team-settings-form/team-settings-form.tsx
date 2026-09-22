import { Controller, useFormContext } from "react-hook-form";
import Input from "@codegouvfr/react-dsfr/Input";
import { TeamSettingsFormValues } from "../team-settings-schema";

export function TeamSettingsForm() {
  const formMethods = useFormContext<TeamSettingsFormValues>();

  return (
    <div className="flex flex-col gap-6">
      <Controller
        control={formMethods.control}
        name="name"
        render={({ field }) => (
          <Input
            state={formMethods.formState.errors.name ? "error" : "default"}
            stateRelatedMessage={formMethods.formState.errors.name?.message}
            label="Nom de l'équipe (obligatoire)"
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
        name="email"
        render={({ field }) => (
          <Input
            state={formMethods.formState.errors.email ? "error" : "default"}
            stateRelatedMessage={formMethods.formState.errors.email?.message}
            label="Adresse e-mail de l'équipe (optionnel)"
            hintText="Adresse générique pour inscriptions et notifications. Format attendu : nom@domaine.fr"
            nativeInputProps={{
              type: "email",
              value: field.value ?? "",
              onChange: (e) => {
                field.onChange(e.target.value || null);
              },
            }}
          />
        )}
      />

      <Controller
        control={formMethods.control}
        name="description"
        render={({ field }) => (
          <Input
            state={
              formMethods.formState.errors.description ? "error" : "default"
            }
            stateRelatedMessage={
              formMethods.formState.errors.description?.message
            }
            hintText="Pour apporter une précision, par exemple les villes ou les quartiers concernées, ou toute autre information utile concernant l'équipe."
            label="Description (optionnel)"
            textArea
            nativeTextAreaProps={{
              value: field.value ?? "",

              onChange: (e) => {
                field.onChange(e.target.value || null);
              },
              rows: 5,
            }}
          />
        )}
      />
    </div>
  );
}
