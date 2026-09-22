import { Controller, useFormContext } from "react-hook-form";
import Input from "@codegouvfr/react-dsfr/Input";
import { InviteColleagueFormValues } from "../invite-colleague.schema";

export function OptionalMessageInput({
  showHintText = true,
}: {
  showHintText?: boolean;
}) {
  const form = useFormContext<InviteColleagueFormValues>();

  return (
    <Controller
      control={form.control}
      name="message"
      render={({ field }) => (
        <Input
          className="mt-6"
          textArea
          label="Votre message (optionnel)"
          hintText={
            showHintText
              ? "Le message sera ajouté à la conversation. Il ne sera pas transmis dans l'e-mail d'invitation."
              : ""
          }
          nativeTextAreaProps={{
            name: field.name,
            value: field.value || "",
            rows: 5,
            onChange: (e) => field.onChange(e.target.value),
          }}
        />
      )}
    />
  );
}
