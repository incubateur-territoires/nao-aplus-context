import { ControllerRenderProps } from "react-hook-form";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { ReportFormValues } from "../../request-form";
import { TeamWithIncludes } from "@/types/request-group-selection";

interface SpecificFieldProps {
  requestedGroup: TeamWithIncludes;
  field: ControllerRenderProps<ReportFormValues, "requestedTeams">;
}

export function SpecificField({ requestedGroup, field }: SpecificFieldProps) {
  const isChecked = field.value?.some((o) => o.value === requestedGroup.id);

  return (
    <div className="specific-field-input">
      <p>
        <span className="font-bold">{requestedGroup.name}</span>
        <span> - {requestedGroup.organization.shortName}</span>
      </p>
      <p className="fr-hint-text -mt-6 min-h-4">
        {requestedGroup.description || ""}
      </p>

      {isChecked && requestedGroup.organization.additionalInformation ? (
        <div className=" mt-4 space-y-6 cursor-default ">
          <Alert
            className="py-2 m-0"
            small
            description={
              requestedGroup.organization.additionalInformation || ""
            }
            severity="info"
          />
        </div>
      ) : null}
    </div>
  );
}
