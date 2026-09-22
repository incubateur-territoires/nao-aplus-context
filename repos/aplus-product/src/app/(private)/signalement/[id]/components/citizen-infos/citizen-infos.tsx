"use client";

import { formatPhoneNumber, formatDate } from "@/utils/format";
import { Row } from "../row/row";
import { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";
import { getRequiredSpecificFieldsFromReport } from "@/app/component/request-form/utils/specific-field.service";
import {
  SpecificFieldKey,
  IDENTITY_FIELDS,
} from "@/app/component/request-form/request-form.schema";

export function CitizenInfos({
  report,
  userTimezone,
}: {
  report: inferRouterOutputs<AppRouter>["report"]["getReportById"];
  userTimezone: string;
}) {
  if (!report) return null;
  const requiredFields = getRequiredSpecificFieldsFromReport(report);

  function shouldDisplayField(
    fieldName: SpecificFieldKey,
    value: string | null | undefined,
  ): boolean {
    // If the field has a value, always display it
    if (value) return true;
    // If the field is null AND it was required, display it with the "cannot provide" message
    if (value === null && requiredFields.includes(fieldName)) return true;
    // Otherwise, don't display it
    return false;
  }

  function getFieldValue(fieldName: SpecificFieldKey): {
    value: string;
    helpText: string;
  } {
    if (!report) return { value: "", helpText: "" };
    const value = report[fieldName];
    // If the field is null and it was required, display the appropriate message
    if (value === null && requiredFields.includes(fieldName)) {
      return {
        value: "Non disponible",
        helpText: `Le citoyen ne peut pas fournir son ${fieldName === IDENTITY_FIELDS.CAF ? "identifiant" : "numéro"} ${fieldName.toUpperCase()}`,
      };
    }
    return { value: value || "", helpText: "" };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-blue-background p-6  h-fit">
        <h5 className="mb-4">Citoyen</h5>
        <hr />
        <div className="flex flex-col">
          <p className="font-bold mb-4!">
            {report?.firstName} {report?.lastName}
          </p>
          <div className="flex flex-col gap-6">
            <Row
              label="Date de naissance"
              value={
                report?.birthDate
                  ? formatDate(report?.birthDate, userTimezone)
                  : ""
              }
            />
            <Row
              label="Numéro de téléphone"
              value={report?.phone ? formatPhoneNumber(report?.phone) : ""}
            />
            {report?.maritalName && (
              <Row label="Nom marital" value={report.maritalName} />
            )}
          </div>
        </div>
      </div>
      {shouldDisplayField(IDENTITY_FIELDS.NIR, report?.nir) ? (
        <div className="bg-blue-background p-6 h-fit">
          <Row
            label="Numéro de sécurité sociale NIR"
            value={getFieldValue(IDENTITY_FIELDS.NIR).value}
            helpText={getFieldValue(IDENTITY_FIELDS.NIR).helpText}
            withCopyButton={report?.nir !== null}
          />
        </div>
      ) : null}
      {shouldDisplayField(IDENTITY_FIELDS.CAF, report?.caf) ? (
        <div className="bg-blue-background p-6  h-fit">
          <Row
            label="Identifiant CAF"
            value={getFieldValue(IDENTITY_FIELDS.CAF).value}
            helpText={getFieldValue(IDENTITY_FIELDS.CAF).helpText}
            withCopyButton={report?.caf !== null}
          />
        </div>
      ) : null}
      {shouldDisplayField(IDENTITY_FIELDS.NIF, report?.nif) ? (
        <div className="bg-blue-background p-6  h-fit">
          <Row
            label="Numéro d'identification fiscale NIF"
            value={getFieldValue(IDENTITY_FIELDS.NIF).value}
            helpText={getFieldValue(IDENTITY_FIELDS.NIF).helpText}
            withCopyButton={report?.nif !== null}
          />
        </div>
      ) : null}
    </div>
  );
}
