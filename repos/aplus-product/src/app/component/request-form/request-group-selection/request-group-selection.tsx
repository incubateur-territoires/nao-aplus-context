import { ChangeEvent, useMemo } from "react";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import {
  Controller,
  useFormContext,
  ControllerRenderProps,
} from "react-hook-form";

import { ReportFormValues } from "../request-form";
import {
  IDENTITY_FIELDS,
  getRequiredSpecificFieldsFromTeams,
} from "../request-form.schema";
import { SpecificField } from "./specific-field/specific-field";
import { useGroupFiltering } from "@/app/hooks/use-group-filtering";
import { TeamWithIncludes } from "@/types/request-group-selection";
import { TeamSelectionContainer } from "../../team-selection-container/team-selection-container";

interface RequestedGroupsSelectionProps {
  aleadyLinkedRequestedTeamsIds?: string[];
}

// Id explicite du fieldset DSFR : rend déterministe l'id du groupe de messages
// (`${id}-messages`) afin de pouvoir le citer dans aria-labelledby.
const REQUESTED_TEAMS_FIELDSET_ID = "requested-teams-fieldset";

export function RequestedGroupsSelection({
  aleadyLinkedRequestedTeamsIds = [],
}: RequestedGroupsSelectionProps) {
  const form = useFormContext<ReportFormValues>();
  const { control } = form;
  const areas = form.watch("area");
  const applicantTeam = form.watch("applicantTeam");
  const areaIds = useMemo(() => areas.map((a) => a.value), [areas]);

  const {
    isLoadingNotInvitedTeams,
    filteredNotInvitedTeams,
    tags,
    selectedFilters,
    setSelectedFilters,
  } = useGroupFiltering(
    { areaIds, applicantTeamId: applicantTeam[0]?.value },
    aleadyLinkedRequestedTeamsIds,
  );

  function handleRequestedGroupCheckboxChange(
    event: React.ChangeEvent<HTMLInputElement>,
    requestedGroup: TeamWithIncludes,
    field: ControllerRenderProps<ReportFormValues, "requestedTeams">,
  ) {
    const checked = event.target.checked;
    const arr = Array.isArray(field.value) ? field.value : [];
    if (checked) {
      field.onChange([
        ...arr,
        {
          label: requestedGroup.name,
          value: requestedGroup.id,
          specificFields: requestedGroup.organization.specificFields.map(
            (sf) => ({
              name: sf.name,
              label: sf.label,
              errorMessage: sf.errorMessage,
              hintText: sf.hintText,
            }),
          ),
        },
      ]);
    } else {
      const updated = arr.filter((o) => o.value !== requestedGroup.id);
      field.onChange(updated);
    }

    const stillRequired = getRequiredSpecificFieldsFromTeams(
      form.getValues("requestedTeams"),
    );
    for (const identityField of Object.values(IDENTITY_FIELDS)) {
      if (!stillRequired.includes(identityField)) {
        form.setValue(identityField, undefined);
        form.clearErrors(identityField);
      }
    }

    // if field is not valid, trigger validation
    if (form.getFieldState("requestedTeams").error) {
      form.trigger("requestedTeams");
    }
  }

  return (
    <TeamSelectionContainer
      tags={tags}
      selectedFilters={selectedFilters}
      setSelectedFilters={setSelectedFilters}
      isLoading={isLoadingNotInvitedTeams}
    >
      <div
        className="mt-6"
        id="specific-field-container"
        data-testid="requested-group-checkbox"
      >
        <Controller
          control={control}
          name="requestedTeams"
          render={({ field }) => (
            <Checkbox
              className="custom-checkbox"
              id={REQUESTED_TEAMS_FIELDSET_ID}
              // Le <fieldset> généré par le DSFR référence par défaut son groupe
              // de messages (l'erreur) dans aria-labelledby, ce qui l'intègre au
              // *nom* du groupe. On rattache plutôt le nom aux textes visibles
              // « Équipe(s) opérateur à contacter » et son aide, et on expose le
              // message d'erreur comme *description* via aria-describedby (a11y).
              aria-labelledby="equipe-operateur-label equipe-operateur-hint"
              aria-describedby={`${REQUESTED_TEAMS_FIELDSET_ID}-messages`}
              legend={
                <span className="fr-sr-only">
                  Équipe(s) opérateur à contacter
                </span>
              }
              state={form.formState.errors.requestedTeams ? "error" : "default"}
              stateRelatedMessage={
                form.formState.errors.requestedTeams?.message as string
              }
              options={[
                // hidden checkbox to get a group of checkbox and have unified style when there is only one checkbox.
                {
                  label: "hidden-checkbox",
                  nativeInputProps: {
                    name: "requestedGroups",
                    value: "hidden-checkbox",
                    id: "hidden-checkbox",
                    className: "hidden",
                    checked: false,
                    onChange: () => {},
                    "aria-hidden": true,
                    tabIndex: -1,
                  },
                },
                ...(filteredNotInvitedTeams?.map((requestedOperatorTeam) => ({
                  label: (
                    <SpecificField
                      requestedGroup={requestedOperatorTeam}
                      field={field}
                    />
                  ),
                  nativeInputProps: {
                    name: "requestedGroups",
                    value: requestedOperatorTeam.id,
                    checked: field.value?.some(
                      (o) => o.value === requestedOperatorTeam.id,
                    ),
                    onChange: (event: ChangeEvent<HTMLInputElement>) => {
                      handleRequestedGroupCheckboxChange(
                        event,
                        requestedOperatorTeam,
                        field,
                      );
                    },
                  },
                })) ?? []),
              ]}
            />
          )}
        />
      </div>
    </TeamSelectionContainer>
  );
}
