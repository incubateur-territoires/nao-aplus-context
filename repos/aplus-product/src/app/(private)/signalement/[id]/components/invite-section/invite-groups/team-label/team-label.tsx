import { TeamWithIncludes } from "@/types/request-group-selection";
import Alert from "@codegouvfr/react-dsfr/Alert";

export function TeamLabel({
  team,
  isChecked,
}: {
  team: TeamWithIncludes;
  isChecked: boolean;
}) {
  return (
    <div className="specific-field-input">
      <p>
        <span className="font-bold">{team.name}</span>
        <span> - {team.organization.shortName}</span>
      </p>
      <p className="fr-hint-text -mt-6 min-h-4">{team.description || ""}</p>

      {isChecked && team.organization.additionalInformation ? (
        <div className="mt-4 space-y-6 cursor-default">
          <Alert
            className="py-2 m-0"
            small
            description={team.organization.additionalInformation || ""}
            severity="info"
          />
        </div>
      ) : null}
    </div>
  );
}
