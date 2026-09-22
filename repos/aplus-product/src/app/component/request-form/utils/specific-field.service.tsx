import { ReportFormValues } from "../request-form";
import {
  SpecificFieldKey,
  getRequiredSpecificFieldsFromTeams,
  IDENTITY_FIELDS,
} from "../request-form.schema";
import { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";

// this service is used to know which requested group is selected and which specific field is required // So we can display the required field in the form in step 2.

export function getRequiredSpecificField(
  requestedTeams: ReportFormValues["requestedTeams"],
): SpecificFieldKey[] {
  return getRequiredSpecificFieldsFromTeams(requestedTeams);
}

type Report = inferRouterOutputs<AppRouter>["report"]["getReportById"];

export function getRequiredSpecificFieldsFromReport(
  report: Report | null,
): SpecificFieldKey[] {
  if (!report?.requestedTeams) {
    return [];
  }

  const requiredFields: SpecificFieldKey[] = [];

  for (const team of report.requestedTeams) {
    if (team.organization?.specificFields) {
      for (const specificField of team.organization.specificFields) {
        const fieldName = specificField.name;
        // Check that the name corresponds to a valid identity field
        if (
          (fieldName === IDENTITY_FIELDS.CAF ||
            fieldName === IDENTITY_FIELDS.NIR ||
            fieldName === IDENTITY_FIELDS.NIF) &&
          !requiredFields.includes(fieldName as SpecificFieldKey)
        ) {
          requiredFields.push(fieldName as SpecificFieldKey);
        }
      }
    }
  }

  return requiredFields;
}
