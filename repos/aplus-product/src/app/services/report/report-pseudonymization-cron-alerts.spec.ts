import { reportPseudonymizationIncidents } from "./report-pseudonymization-cron-alerts";
import type { ReportPseudonymizationRunResult } from "./report-pseudonymization-cron";

function result(
  overrides: Partial<ReportPseudonymizationRunResult> = {},
): ReportPseudonymizationRunResult {
  return {
    enabled: true,
    reportsPseudonymized: 0,
    answersPseudonymized: 0,
    refused: 0,
    errors: [],
    outage: false,
    callsUsed: 0,
    callLimit: 900,
    reportsAwaiting: 0,
    answersAwaiting: 0,
    ...overrides,
  };
}

describe("reportPseudonymizationIncidents", () => {
  it("ne remonte rien sur un run sans incident, refus compris", () => {
    expect(reportPseudonymizationIncidents(result({ refused: 4 }))).toEqual([]);
  });

  it("remonte erreurs et panne avec une empreinte stable", () => {
    const incidents = reportPseudonymizationIncidents(
      result({
        errors: [{ reportId: "r1", error: "bug" }],
        outage: true,
      }),
    );

    expect(incidents.map((incident) => incident.fingerprint)).toEqual([
      ["report-pseudonymization", "errors"],
      ["report-pseudonymization", "outage"],
    ]);
  });
});
