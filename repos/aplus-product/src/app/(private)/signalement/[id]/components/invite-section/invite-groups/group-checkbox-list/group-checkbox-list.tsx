import { Controller, useFormContext } from "react-hook-form";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { InviteGroupsFormValues } from "../invite-groups.schema";
import { TeamWithIncludes } from "@/types/request-group-selection";
import { TeamLabel } from "../team-label/team-label";

interface GroupCheckboxListProps {
  filteredNotInvitedTeams: TeamWithIncludes[] | undefined;
}

// Id explicite du fieldset DSFR : rend déterministe l'id du groupe de messages
// (`${id}-messages`) afin de pouvoir le citer dans aria-labelledby.
const INVITE_TEAMS_FIELDSET_ID = "invite-teams-fieldset";

export function GroupCheckboxList({
  filteredNotInvitedTeams,
}: GroupCheckboxListProps) {
  const form = useFormContext<InviteGroupsFormValues>();

  return (
    <div className="mt-6" data-testid="requested-group-checkbox">
      <Controller
        control={form.control}
        name="teamIds"
        render={({ field }) => (
          <Checkbox
            className="custom-checkbox"
            id={INVITE_TEAMS_FIELDSET_ID}
            // Le <fieldset> généré par le DSFR référence par défaut son groupe de
            // messages (l'erreur) dans aria-labelledby, ce qui l'intègre au *nom*
            // du groupe. On rattache plutôt le nom aux textes visibles « Équipe(s)
            // opérateur à contacter » et son aide (rendus par TeamSelectionContainer),
            // et on expose le message d'erreur comme *description* via aria-describedby.
            aria-labelledby="equipe-operateur-label equipe-operateur-hint"
            aria-describedby={`${INVITE_TEAMS_FIELDSET_ID}-messages`}
            state={form.formState.errors.teamIds ? "error" : "default"}
            stateRelatedMessage={
              form.formState.errors.teamIds?.message as string
            }
            options={[
              {
                label: "hidden-checkbox",
                nativeInputProps: {
                  name: "teamIds",
                  value: "hidden-checkbox",
                  id: "hidden-checkbox",
                  className: "hidden",
                  checked: false,
                  onChange: () => {},
                },
              },
              ...(filteredNotInvitedTeams?.map((team) => ({
                label: (
                  <TeamLabel
                    team={team}
                    isChecked={field.value.includes(team.id)}
                  />
                ),
                nativeInputProps: {
                  name: "teamIds",
                  value: team.id,
                  checked: field.value.includes(team.id),
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    const checked = event.target.checked;
                    const currentValue = field.value || [];
                    if (checked) {
                      field.onChange([...currentValue, team.id]);
                    } else {
                      field.onChange(
                        currentValue.filter((id) => id !== team.id),
                      );
                    }
                  },
                },
              })) ?? []),
            ]}
          />
        )}
      />
    </div>
  );
}
