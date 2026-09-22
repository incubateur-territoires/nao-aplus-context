import Input from "@codegouvfr/react-dsfr/Input";
import { Control, Controller, FieldErrors } from "react-hook-form";
import { FormValues } from "../types";

interface MessageInputProps {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
}

export function MessageInput({ control, errors }: MessageInputProps) {
  return (
    <Controller
      control={control}
      name="message"
      render={({ field }) => (
        <Input
          className="mt-10"
          textArea
          label="Votre message (obligatoire)"
          state={errors.message ? "error" : "default"}
          stateRelatedMessage={errors.message?.message || ""}
          nativeTextAreaProps={{
            "aria-required": true,
            value: field.value,
            rows: 5,
            onChange: (e) => {
              field.onChange(e.target.value);
            },
          }}
        />
      )}
    />
  );
}
