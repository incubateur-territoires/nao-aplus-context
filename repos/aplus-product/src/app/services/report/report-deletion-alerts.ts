import * as Sentry from "@sentry/nextjs";
import type { ReportDeletionResult } from "./report-deletion";

/**
 * Incidents du cron `reports/deletion`, envoyés à Sentry plutôt que listés dans
 * Mattermost, où un run de plusieurs centaines de signalements les noyait.
 *
 * Une empreinte stable par nature d'incident : un problème qui dure reste un
 * ticket qui grossit, au lieu d'un ticket par nuit que personne ne relit.
 */

/** Stock de textes en attente au-delà duquel le retard devient un incident. */
export const PENDING_ALERT_THRESHOLD = 1_000;

const INCIDENT_KINDS = {
  ERRORS: "errors",
  FILE_ERRORS: "file-errors",
  OUTAGE: "outage",
  PENDING: "pending",
} as const;

type IncidentKind = (typeof INCIDENT_KINDS)[keyof typeof INCIDENT_KINDS];

export interface ReportDeletionIncident {
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
  level: ReportDeletionIncident["level"],
  extra: Record<string, unknown>,
): ReportDeletionIncident {
  return {
    kind,
    message,
    level,
    fingerprint: ["report-deletion", kind],
    extra,
  };
}

export function reportDeletionIncidents(
  result: ReportDeletionResult,
): ReportDeletionIncident[] {
  const incidents: ReportDeletionIncident[] = [];

  if (result.errors.length > 0) {
    incidents.push(
      incident(
        INCIDENT_KINDS.ERRORS,
        "Signalements non supprimés par le cron",
        "error",
        { count: result.errors.length, errors: result.errors },
      ),
    );
  }

  if (result.fileErrors.length > 0) {
    incidents.push(
      incident(
        INCIDENT_KINDS.FILE_ERRORS,
        "Fichiers non supprimés du bucket par le cron",
        "warning",
        { count: result.fileErrors.length, fileErrors: result.fileErrors },
      ),
    );
  }

  if (result.pseudonymizationOutage) {
    incidents.push(
      incident(
        INCIDENT_KINDS.OUTAGE,
        "Pipeline de caviardage indisponible",
        "error",
        { awaiting: result.awaitingPseudonymizationCount },
      ),
    );
  }

  if (result.awaitingPseudonymizationCount >= PENDING_ALERT_THRESHOLD) {
    incidents.push(
      incident(
        INCIDENT_KINDS.PENDING,
        "Stock de textes en attente de caviardage",
        "warning",
        { awaiting: result.awaitingPseudonymizationCount },
      ),
    );
  }

  return incidents;
}

export function sendReportDeletionAlerts(result: ReportDeletionResult): void {
  for (const {
    kind,
    message,
    level,
    fingerprint,
    extra,
  } of reportDeletionIncidents(result)) {
    Sentry.captureMessage(message, {
      level,
      fingerprint,
      tags: { cron: "reports/deletion", incident: kind },
      extra,
    });
  }
}
