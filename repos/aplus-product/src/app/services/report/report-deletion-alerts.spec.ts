import * as Sentry from "@sentry/nextjs";
import {
  PENDING_ALERT_THRESHOLD,
  reportDeletionIncidents,
  sendReportDeletionAlerts,
} from "./report-deletion-alerts";
import type { ReportDeletionResult } from "./report-deletion";

jest.mock("@sentry/nextjs", () => ({ captureMessage: jest.fn() }));

function result(
  overrides: Partial<ReportDeletionResult> = {},
): ReportDeletionResult {
  return {
    reportsDeleted: [{ id: "r-1" }],
    pseudonymized: [{ id: "r-1" }],
    awaitingPseudonymization: [],
    awaitingPseudonymizationCount: 0,
    contentErased: [],
    skipped: [],
    fileErrors: [],
    errors: [],
    pseudonymizationOutage: false,
    pseudonymizationEnabled: true,
    ...overrides,
  };
}

describe("reportDeletionIncidents", () => {
  it("ne signale rien sur un run sans incident", () => {
    expect(reportDeletionIncidents(result())).toEqual([]);
  });

  it("regroupe les erreurs de dossier sous une empreinte stable", () => {
    const [incident] = reportDeletionIncidents(
      result({ errors: [{ reportId: "r-2", error: "Transaction expirée" }] }),
    );

    expect(incident).toMatchObject({
      level: "error",
      fingerprint: ["report-deletion", "errors"],
      extra: { errors: [{ reportId: "r-2", error: "Transaction expirée" }] },
    });
  });

  it("signale séparément les fichiers non supprimés et la panne du caviardage", () => {
    const incidents = reportDeletionIncidents(
      result({
        fileErrors: [{ reportId: "r-3", fileId: "f-1", error: "S3" }],
        pseudonymizationOutage: true,
      }),
    );

    expect(incidents.map((incident) => incident.fingerprint)).toEqual([
      ["report-deletion", "file-errors"],
      ["report-deletion", "outage"],
    ]);
  });

  it("alerte sur le stock en attente à partir du seuil seulement", () => {
    const below = result({
      awaitingPseudonymizationCount: PENDING_ALERT_THRESHOLD - 1,
    });
    const atThreshold = result({
      awaitingPseudonymizationCount: PENDING_ALERT_THRESHOLD,
    });

    expect(reportDeletionIncidents(below)).toEqual([]);
    expect(reportDeletionIncidents(atThreshold)[0].fingerprint).toEqual([
      "report-deletion",
      "pending",
    ]);
  });
});

describe("sendReportDeletionAlerts", () => {
  it("envoie un événement Sentry par incident", () => {
    sendReportDeletionAlerts(
      result({
        errors: [{ reportId: "r-2", error: "Transaction expirée" }],
        pseudonymizationOutage: true,
      }),
    );

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        fingerprint: ["report-deletion", "errors"],
        tags: { cron: "reports/deletion", incident: "errors" },
      }),
    );
  });
});
