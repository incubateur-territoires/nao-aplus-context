import Button from "@codegouvfr/react-dsfr/Button";
import { Control, FieldErrors } from "react-hook-form";
import { MessageInput } from "../message-input/message-input";
import { FileUploadField } from "../file-upload-field/file-upload-field";
import { ToggleSwitches } from "../toggle-switches/toggle-switches";
import { FormValues } from "../types";
import { Spinner } from "@/app/component/spinner/spinner";

interface FormFieldsProps {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  showInstructorOnly: boolean;
  showIsIrrelevant: boolean;
  isSubmitting: boolean;
  submitLabel: string;
}

/**
 * Form fields section - displays message input, file upload, toggle switches and submit button
 */
export function FormFields({
  control,
  errors,
  showInstructorOnly,
  showIsIrrelevant,
  isSubmitting,
  submitLabel,
}: FormFieldsProps) {
  return (
    <>
      <MessageInput control={control} errors={errors} />

      <FileUploadField control={control} />

      <ToggleSwitches
        control={control}
        showInstructorOnly={showInstructorOnly}
        showIsIrrelevant={showIsIrrelevant}
      />

      <Button
        disabled={isSubmitting}
        className="mt-10 flex justify-end float-right"
        size="large"
        type="submit"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Spinner className="text-gray-500" />
            Envoi en cours…
          </span>
        ) : (
          submitLabel
        )}
      </Button>
    </>
  );
}
