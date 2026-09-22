import { memo } from "react";
import { ReportStatus } from "@/generated/prisma/enums";
import { RenderChoiceForm } from "../render-choice/render-choice-form/render-choice-form";
import { FormProvider } from "react-hook-form";
import { useAnswerForm } from "../render-choice/render-choice-form/use-answer-form";
import { MessageInput } from "../render-choice/render-choice-form/message-input/message-input";
import { FileUploadField } from "../render-choice/render-choice-form/file-upload-field/file-upload-field";
import { ToggleSwitches } from "../render-choice/render-choice-form/toggle-switches/toggle-switches";
import { FormError } from "../render-choice/render-choice-form/form-error/form-error";
import { Button } from "@codegouvfr/react-dsfr/Button";

export enum ActionChoiceValue {
  IN_TREATMENT = "IN_TREATMENT",
  COMPLETED = "COMPLETED",
  SEND_MESSAGE = "SEND_MESSAGE",
  INVITE = "INVITE",
}

export interface ActionChoiceFormValues {
  actionChoice: ActionChoiceValue | null;
}

interface ActionChoiceProps {
  currentStatus: ReportStatus;
  isAuthor: boolean;
}

// Stable empty function reference
const noop = () => {};

function ActionChoiceComponent({ currentStatus, isAuthor }: ActionChoiceProps) {
  const {
    formMethods,
    onSubmit,
    isCreatingAnswer,
    isUploadingFiles,
    error,
    apiError,
  } = useAnswerForm({
    resetSelectedChoice: noop,
    defaultActionChoice: isAuthor ? ActionChoiceValue.SEND_MESSAGE : null,
  });
  if (isAuthor) {
    return (
      <div className="p-4 md:p-8 lg:p-20 bg-white relative gap-4 flex flex-col mt-6">
        <h2 className="text-[32px] font-bold leading-[40px] text-[#161616] m-0">
          Ajouter un message ou un fichier au signalement
        </h2>
        <FormProvider {...formMethods}>
          <form onSubmit={formMethods.handleSubmit(onSubmit)}>
            <MessageInput
              control={formMethods.control}
              errors={formMethods.formState.errors}
            />
            <FileUploadField control={formMethods.control} />
            <ToggleSwitches
              control={formMethods.control}
              showInstructorOnly={false}
              showIsIrrelevant={false}
            />
            <Button
              disabled={isCreatingAnswer || isUploadingFiles}
              className="mt-10 flex justify-end float-right"
              size="large"
              type="submit"
            >
              Ajouter un message
            </Button>

            {error && <FormError message={error.message} />}
            {apiError && <FormError message={apiError} />}
          </form>
        </FormProvider>
      </div>
    );
  }
  return (
    <div
      id="action-choice"
      className="p-4 md:p-8 lg:p-20 bg-white relative gap-4 flex flex-col mt-6"
    >
      <h2 className="text-[32px] font-bold leading-[40px] text-[#161616] m-0">
        Répondre au signalement
      </h2>
      <RenderChoiceForm
        resetSelectedChoice={noop}
        currentStatus={currentStatus}
      />
    </div>
  );
}

// Memoize to prevent re-renders when parent re-renders unnecessarily
export const ActionChoice = memo(ActionChoiceComponent);
