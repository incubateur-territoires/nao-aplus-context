import { Controller, useFormContext } from "react-hook-form";
import Input from "@codegouvfr/react-dsfr/Input";
import { InviteGroupsFormValues } from "../invite-groups.schema";

export function MessageInput({ isRequired = true }: { isRequired?: boolean }) {
  const form = useFormContext<InviteGroupsFormValues>();

  return (
    <Controller
      control={form.control}
      name="message"
      render={({ field }) => (
        <Input
          className="mt-6"
          textArea
          state={form.formState.errors.message ? "error" : "default"}
          stateRelatedMessage={form.formState.errors.message?.message}
          label={
            isRequired
              ? "Votre message (obligatoire)"
              : "Votre message (optionnel)"
          }
          hintText="Le message sera ajouté à la conversation. Il ne sera pas transmis dans l'e-mail d'invitation."
          nativeTextAreaProps={{
            name: field.name,
            "aria-required": isRequired,
            value: field.value || "",
            rows: 5,
            onChange: (e) => field.onChange(e.target.value),
          }}
        />
      )}
    />
  );
}
