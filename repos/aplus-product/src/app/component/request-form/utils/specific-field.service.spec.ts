import { getRequiredSpecificFieldsFromReport } from "./specific-field.service";
import { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";
import { IDENTITY_FIELDS } from "../request-form.schema";

type Report = inferRouterOutputs<AppRouter>["report"]["getReportById"];

describe("getRequiredSpecificFieldsFromReport", () => {
  it("returns empty array when report is null", () => {
    const result = getRequiredSpecificFieldsFromReport(null);
    expect(result).toEqual([]);
  });

  it("returns empty array when requestedTeams is missing", () => {
    const report = {
      requestedTeams: null,
    } as unknown as Report;
    const result = getRequiredSpecificFieldsFromReport(report);
    expect(result).toEqual([]);
  });

  it("returns empty array when requestedTeams is empty", () => {
    const report = {
      requestedTeams: [],
    } as unknown as Report;
    const result = getRequiredSpecificFieldsFromReport(report);
    expect(result).toEqual([]);
  });

  it("extracts required fields from single team with single field", () => {
    const report = {
      requestedTeams: [
        {
          id: "team1",
          organization: {
            specificFields: [
              {
                id: "field1",
                name: IDENTITY_FIELDS.NIR,
                label: "NIR",
                errorMessage: "NIR required",
                hintText: "13 ou 15 chiffres",
              },
            ],
          },
        },
      ],
    } as unknown as Report;

    const result = getRequiredSpecificFieldsFromReport(report);
    expect(result).toEqual([IDENTITY_FIELDS.NIR]);
  });

  it("extracts required fields from single team with multiple fields", () => {
    const report = {
      requestedTeams: [
        {
          id: "team1",
          organization: {
            specificFields: [
              {
                id: "field1",
                name: IDENTITY_FIELDS.NIR,
                label: "NIR",
                errorMessage: "NIR required",
              },
              {
                id: "field2",
                name: IDENTITY_FIELDS.CAF,
                label: "CAF",
                errorMessage: "CAF required",
              },
            ],
          },
        },
      ],
    } as unknown as Report;

    const result = getRequiredSpecificFieldsFromReport(report);
    expect(result).toContain(IDENTITY_FIELDS.NIR);
    expect(result).toContain(IDENTITY_FIELDS.CAF);
    expect(result).toHaveLength(2);
  });

  it("extracts required fields from multiple teams", () => {
    const report = {
      requestedTeams: [
        {
          id: "team1",
          organization: {
            specificFields: [
              {
                id: "field1",
                name: IDENTITY_FIELDS.NIR,
                label: "NIR",
                errorMessage: "NIR required",
              },
            ],
          },
        },
        {
          id: "team2",
          organization: {
            specificFields: [
              {
                id: "field2",
                name: IDENTITY_FIELDS.CAF,
                label: "CAF",
                errorMessage: "CAF required",
              },
              {
                id: "field3",
                name: IDENTITY_FIELDS.NIF,
                label: "NIF",
                errorMessage: "NIF required",
              },
            ],
          },
        },
      ],
    } as unknown as Report;

    const result = getRequiredSpecificFieldsFromReport(report);
    expect(result).toContain(IDENTITY_FIELDS.NIR);
    expect(result).toContain(IDENTITY_FIELDS.CAF);
    expect(result).toContain(IDENTITY_FIELDS.NIF);
    expect(result).toHaveLength(3);
  });

  it("deduplicates fields when multiple teams require the same field", () => {
    const report = {
      requestedTeams: [
        {
          id: "team1",
          organization: {
            specificFields: [
              {
                id: "field1",
                name: IDENTITY_FIELDS.NIR,
                label: "NIR",
                errorMessage: "NIR required",
              },
            ],
          },
        },
        {
          id: "team2",
          organization: {
            specificFields: [
              {
                id: "field2",
                name: IDENTITY_FIELDS.NIR,
                label: "NIR",
                errorMessage: "NIR required",
              },
            ],
          },
        },
      ],
    } as unknown as Report;

    const result = getRequiredSpecificFieldsFromReport(report);
    expect(result).toEqual([IDENTITY_FIELDS.NIR]);
  });

  it("ignores teams without organization", () => {
    const report = {
      requestedTeams: [
        {
          id: "team1",
          organization: null,
        },
        {
          id: "team2",
          organization: {
            specificFields: [
              {
                id: "field1",
                name: IDENTITY_FIELDS.NIR,
                label: "NIR",
                errorMessage: "NIR required",
              },
            ],
          },
        },
      ],
    } as unknown as Report;

    const result = getRequiredSpecificFieldsFromReport(report);
    expect(result).toEqual([IDENTITY_FIELDS.NIR]);
  });

  it("ignores organizations without specificFields", () => {
    const report = {
      requestedTeams: [
        {
          id: "team1",
          organization: {
            specificFields: null,
          },
        },
        {
          id: "team2",
          organization: {
            specificFields: [
              {
                id: "field1",
                name: IDENTITY_FIELDS.CAF,
                label: "CAF",
                errorMessage: "CAF required",
              },
            ],
          },
        },
      ],
    } as unknown as Report;

    const result = getRequiredSpecificFieldsFromReport(report);
    expect(result).toEqual([IDENTITY_FIELDS.CAF]);
  });

  it("filters out invalid field names", () => {
    const report = {
      requestedTeams: [
        {
          id: "team1",
          organization: {
            specificFields: [
              {
                id: "field1",
                name: IDENTITY_FIELDS.NIR,
                label: "NIR",
                errorMessage: "NIR required",
              },
              {
                id: "field2",
                name: "invalid-field",
                label: "Invalid",
                errorMessage: "Invalid required",
              },
            ],
          },
        },
      ],
    } as unknown as Report;

    const result = getRequiredSpecificFieldsFromReport(report);
    expect(result).toEqual([IDENTITY_FIELDS.NIR]);
    expect(result).not.toContain("invalid-field");
  });
});
