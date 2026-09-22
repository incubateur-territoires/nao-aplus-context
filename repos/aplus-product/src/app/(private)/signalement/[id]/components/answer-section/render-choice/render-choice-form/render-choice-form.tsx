import { ReportStatus } from "@/generated/prisma/client";
import { FormProvider } from "react-hook-form";
import { useEffect } from "react";
import { ActionChoiceRadio } from "./action-choice-radio/action-choice-radio";
import { FormFields } from "./form-fields/form-fields";
import { FormErrors } from "./form-errors/form-errors";
import { useAnswerForm } from "./use-answer-form";
import {
  getActionChoiceLabel,
  getDefaultMessage,
  getToggleSwitchesVisibility,
} from "./utils";

export type { FormValues as Values } from "./types";

interface RenderChoiceFormProps {
  resetSelectedChoice: () => void;
  currentStatus?: ReportStatus;
}

/**
 * Main form component for handling report actions (take charge, complete, send message, invite)
 * Dynamically shows/hides fields based on the selected action choice
 */
export function RenderChoiceForm({
  resetSelectedChoice,
  currentStatus,
}: RenderChoiceFormProps) {
  const {
    formMethods,
    onSubmit,
    isCreatingAnswer,
    isUploadingFiles,
    isError,
    error,
    apiError,
  } = useAnswerForm({
    resetSelectedChoice,
  });

  const selectedActionChoice = formMethods.watch("actionChoice");
  const { showInstructorOnly, showIsIrrelevant } =
    getToggleSwitchesVisibility(selectedActionChoice);

  // Auto-populate message field with default text when action choice changes
  // and clear message error when action choice changes
  useEffect(() => {
    const defaultMessage = getDefaultMessage(selectedActionChoice);
    formMethods.setValue("message", defaultMessage);
    // Clear message error when action choice changes
    if (formMethods.formState.errors.message) {
      formMethods.clearErrors("message");
    }
  }, [selectedActionChoice, formMethods]);

  const callToActionLabel = selectedActionChoice
    ? getActionChoiceLabel(selectedActionChoice)
    : "Répondre au signalement";

  const isSubmitting = isCreatingAnswer || isUploadingFiles;

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)}>
        {/* Step 1: Select action type */}
        <ActionChoiceRadio currentStatus={currentStatus} />

        {/* Step 2: Fill in details (only visible after action selection) */}
        {selectedActionChoice && (
          <FormFields
            control={formMethods.control}
            errors={formMethods.formState.errors}
            showInstructorOnly={showInstructorOnly}
            showIsIrrelevant={showIsIrrelevant}
            isSubmitting={isSubmitting}
            submitLabel={callToActionLabel}
          />
        )}

        {/* Step 3: Display errors if any */}
        <FormErrors isError={isError} error={error} apiError={apiError} />
      </form>
    </FormProvider>
  );
}
