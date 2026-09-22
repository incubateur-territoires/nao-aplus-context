import { Controller, useFormContext } from "react-hook-form";
import Checkbox from "@codegouvfr/react-dsfr/Checkbox";
import { InviteColleagueFormValues } from "../invite-colleague.schema";

interface ColleagueCheckboxListProps {
  colleagues: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }[];
}

export function ColleagueCheckboxList({
  colleagues,
}: ColleagueCheckboxListProps) {
  const form = useFormContext<InviteColleagueFormValues>();

  return (
    <Controller
      control={form.control}
      name="colleagueIds"
      render={({ field }) => (
        <Checkbox
          legend="Sélectionnez les membres de l'équipe à inviter :"
          state={form.formState.errors.colleagueIds ? "error" : "default"}
          stateRelatedMessage={
            form.formState.errors.colleagueIds?.message as string
          }
          options={colleagues.map((colleague) => ({
            label:
              colleague.firstName && colleague.lastName
                ? `${colleague.firstName} ${colleague.lastName}`
                : colleague.email,
            nativeInputProps: {
              name: "colleagueIds",
              value: colleague.id,
              checked: field.value.includes(colleague.id),
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                const checked = event.target.checked;
                const currentValue = field.value || [];
                if (checked) {
                  field.onChange([...currentValue, colleague.id]);
                } else {
                  field.onChange(
                    currentValue.filter((id) => id !== colleague.id),
                  );
                }
              },
            },
          }))}
        />
      )}
    />
  );
}
