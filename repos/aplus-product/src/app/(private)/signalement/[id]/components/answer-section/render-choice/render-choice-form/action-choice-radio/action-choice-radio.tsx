import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import DOMPurify from "isomorphic-dompurify";
import { Controller, useFormContext } from "react-hook-form";
import { ACTION_CHOICE_OPTIONS } from "../constants";
import { FormValues } from "../types";
import { ReportStatus } from "@/generated/prisma/enums";

interface ActionChoiceRadioProps {
  currentStatus?: ReportStatus;
}

export function ActionChoiceRadio({ currentStatus }: ActionChoiceRadioProps) {
  const { formState, control } = useFormContext<FormValues>();
  function getOptions() {
    // If already IN_TREATMENT, hide the IN_TREATMENT option
    if (currentStatus === ReportStatus.IN_TREATMENT) {
      return ACTION_CHOICE_OPTIONS.filter(
        (option) => option.value !== "IN_TREATMENT",
      );
    }
    if (
      currentStatus === ReportStatus.COMPLETED ||
      currentStatus === ReportStatus.CLOSED
    ) {
      return ACTION_CHOICE_OPTIONS.filter(
        (option) => option.value !== "COMPLETED",
      );
    }
    return ACTION_CHOICE_OPTIONS;
  }
  const options = getOptions();

  return (
    <Controller
      control={control}
      name="actionChoice"
      render={({ field }) => (
        <RadioButtons
          options={options.map((option) => ({
            label: option.label,
            hintText: (
              <p
                className="text-xs m-0 font-regular text-[#666666]"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(option.hintText),
                }}
              />
            ),
            nativeInputProps: {
              name: field.name,
              value: option.value,
              checked: field.value === option.value,
              onChange: () => field.onChange(option.value),
            },
          }))}
          legend="Répondre au signalement"
          classes={{ legend: "fr-sr-only" }}
          id={field.name}
          // Le DSFR référence par défaut le message d'erreur dans aria-labelledby
          // (donc dans le *nom* du groupe). On limite le nom à la légende et on
          // expose l'erreur comme *description* via aria-describedby (a11y).
          aria-labelledby={`${field.name}-legend`}
          aria-describedby={`${field.name}-messages`}
          state={formState.errors.actionChoice ? "error" : "default"}
          stateRelatedMessage={formState.errors.actionChoice?.message as string}
        />
      )}
    />
  );
}
