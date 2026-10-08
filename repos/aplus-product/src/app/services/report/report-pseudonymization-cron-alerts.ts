import * as Sentry from "@sentry/nextjs";
import type { ReportPseudonymizationRunResult } from "./report-pseudonymization-cron";

/**
 * Incidents du cron `reports/pseudonymization`, avec une empreinte stable par
 * nature pour qu'un problème qui dure reste un seul ticket.
 */

const INCIDENT_KINDS = {
  ERRORS: "errors",
  OUTAGE: "outage",
} as const;

type IncidentKind = (typeof INCIDENT_KINDS)[keyof typeof INCIDENT_KINDS];

export interface ReportPseudonymizationIncident {
  kind: IncidentKind;
  message: string;
  level: "error" | "warning";
  fingerprint: string[];
  /** Identifiants et erreurs techniques seulement, jamais un texte de signalement. */
  extra: Record<string, unknown>;
}

function incident(
  kind: IncidentKind,
  message: string,
  level: ReportPseudonymizationIncident["level"],
  extra: Record<string, unknown>,
): ReportPseudonymizationIncident {
  return {
    kind,
    message,
    level,
    fingerprint: ["report-pseudonymization", kind],
    extra,
  };
}

export function reportPseudonymizationIncidents(
  result: ReportPseudonymizationRunResult,
): ReportPseudonymizationIncident[] {
  const incidents: ReportPseudonymizationIncident[] = [];

  if (result.errors.length > 0) {
    incidents.push(
      incident(
        INCIDENT_KINDS.ERRORS,
        "Signalements non pseudonymisés par le cron",
        "error",
        { count: result.errors.length, errors: result.errors },
      ),
    );
  }

  if (result.outage) {
    incidents.push(
      incident(
        INCIDENT_KINDS.OUTAGE,
        "Pipeline de caviardage indisponible pendant la pseudonymisation",
        "warning",
        { reportsAwaiting: result.reportsAwaiting },
      ),
    );
  }

  return incidents;
}

export function sendReportPseudonymizationAlerts(
  result: ReportPseudonymizationRunResult,
): void {
  for (const {
    kind,
    message,
    level,
    fingerprint,
    extra,
  } of reportPseudonymizationIncidents(result)) {
    Sentry.captureMessage(message, {
      level,
      fingerprint,
      tags: { cron: "reports/pseudonymization", incident: kind },
      extra,
    });
  }
}
