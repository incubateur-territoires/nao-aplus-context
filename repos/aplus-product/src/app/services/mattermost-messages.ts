import type { EmailBatchOutcome } from "@/app/services/email/email-batch";
import { buildReportUrl } from "@/utils/report-url";

function buildReportRows(reportIds: string[]): string {
  return reportIds
    .map(
      (id, index) =>
        `| ${index + 1} | \`${id.slice(0, 8)}...\` | [Voir le signalement](${buildReportUrl(id)}) |`,
    )
    .join("\n");
}

function buildEmailFailureBlock(emails: EmailBatchOutcome): string {
  if (emails.failures.length === 0) return "";

  const failureList = emails.failures
    .map(
      (failure) => `  - \`${failure.ref.slice(0, 8)}...\` - ${failure.error}`,
    )
    .join("\n");

  return `\n\n> :email: **${emails.failures.length}** échec(s) d'envoi d'e-mail sur ${emails.sent.length + emails.failures.length} tentative(s)\n${failureList}`;
}

export function buildOverdueReportsMessage(
  reportIds: string[],
  emails: EmailBatchOutcome,
): string {
  return `**CRON - Signalements en souffrance**

> **${reportIds.length}** signalement(s) viennent d'être marqués "En souffrance"

| # | ID | Action |
|:---:|:---|:---|
${buildReportRows(reportIds)}${buildEmailFailureBlock(emails)}`;
}

export function buildNoOverdueReportsMessage(): string {
  return `**CRON - Signalements en souffrance**

> Il n'y a pas de signalements en souffrance aujourd'hui :white_check_mark:`;
}

export interface InactivityUserInfo {
  id: string;
  email: string;
}

export interface InactivitySummary {
  usersWarned4Months: InactivityUserInfo[];
  usersWarned5Months: InactivityUserInfo[];
  usersDeactivated: InactivityUserInfo[];
  errors: { userId: string; error: string }[];
}

function formatUserList(users: InactivityUserInfo[]): string {
  return users
    .map((u) => `  - \`${u.id.slice(0, 8)}...\` - ${u.email}`)
    .join("\n");
}

export function buildInactivitySummaryMessage(
  summary: InactivitySummary,
): string {
  const lines: string[] = ["**CRON - Comptes inactifs**"];

  if (summary.usersWarned4Months.length > 0) {
    lines.push(
      `> :warning: **${summary.usersWarned4Months.length}** utilisateur(s) averti(s) (4 mois d'inactivité)\n${formatUserList(summary.usersWarned4Months)}`,
    );
  }

  if (summary.usersWarned5Months.length > 0) {
    lines.push(
      `> :exclamation: **${summary.usersWarned5Months.length}** utilisateur(s) averti(s) (5 mois - dernier avertissement)\n${formatUserList(summary.usersWarned5Months)}`,
    );
  }

  if (summary.usersDeactivated.length > 0) {
    lines.push(
      `> :no_entry: **${summary.usersDeactivated.length}** compte(s) désactivé(s) (6 mois d'inactivité)\n${formatUserList(summary.usersDeactivated)}`,
    );
  }

  if (summary.errors.length > 0) {
    const errorList = summary.errors
      .map((e) => `  - \`${e.userId.slice(0, 8)}...\` - ${e.error}`)
      .join("\n");
    lines.push(`> :x: **${summary.errors.length}** erreur(s)\n${errorList}`);
  }

  if (
    summary.usersWarned4Months.length === 0 &&
    summary.usersWarned5Months.length === 0 &&
    summary.usersDeactivated.length === 0 &&
    summary.errors.length === 0
  ) {
    lines.push(
      `> Aucun utilisateur inactif à traiter aujourd'hui :white_check_mark:`,
    );
  }

  return lines.join("\n\n");
}

export function buildAutoClosedReportsMessage(
  reportIds: string[],
  emails: EmailBatchOutcome,
): string {
  return `**CRON - Fermeture automatique de signalements**

> **${reportIds.length}** signalement(s) traité(s) depuis plus de 30 jours ont été automatiquement fermés

| # | ID | Action |
|:---:|:---|:---|
${buildReportRows(reportIds)}${buildEmailFailureBlock(emails)}`;
}

export function buildNoAutoClosedReportsMessage(): string {
  return `**CRON - Fermeture automatique de signalements**

> Aucun signalement à fermer automatiquement aujourd'hui :white_check_mark:`;
}

export interface ReportDeletionSummary {
  reportsDeleted: { id: string }[];
  fileErrors: { reportId: string; fileId: string; error: string }[];
  errors: { reportId: string; error: string }[];
}

export function buildDeletedReportsMessage(
  summary: ReportDeletionSummary,
): string {
  const lines: string[] = [
    "**CRON - Suppression de signalements (6 mois après fermeture)**",
  ];

  if (summary.reportsDeleted.length > 0) {
    const list = summary.reportsDeleted
      .map((r) => `  - \`${r.id.slice(0, 8)}...\``)
      .join("\n");
    lines.push(
      `> :wastebasket: **${summary.reportsDeleted.length}** signalement(s) anonymisé(s) et supprimé(s)\n${list}`,
    );
  }

  if (summary.fileErrors.length > 0) {
    const list = summary.fileErrors
      .map(
        (e) =>
          `  - report \`${e.reportId.slice(0, 8)}...\` / fichier \`${e.fileId.slice(0, 8)}...\` - ${e.error}`,
      )
      .join("\n");
    lines.push(
      `> :warning: **${summary.fileErrors.length}** erreur(s) de suppression de fichier S3\n${list}`,
    );
  }

  if (summary.errors.length > 0) {
    const list = summary.errors
      .map((e) => `  - \`${e.reportId.slice(0, 8)}...\` - ${e.error}`)
      .join("\n");
    lines.push(`> :x: **${summary.errors.length}** erreur(s)\n${list}`);
  }

  return lines.join("\n\n");
}

export function buildNoDeletedReportsMessage(): string {
  return `**CRON - Suppression de signalements (6 mois après fermeture)**

> Aucun signalement à supprimer aujourd'hui :white_check_mark:`;
}

export interface SoftDeletionSummary {
  usersDeleted: InactivityUserInfo[];
  emailErrors: { userId: string; error: string }[];
  errors: { userId: string; error: string }[];
}

export function buildSoftDeletionSummaryMessage(
  summary: SoftDeletionSummary,
): string {
  const lines: string[] = ["**CRON - Suppression de comptes (2 ans)**"];

  if (summary.usersDeleted.length > 0) {
    lines.push(
      `> :wastebasket: **${summary.usersDeleted.length}** compte(s) supprimé(s)\n${formatUserList(summary.usersDeleted)}`,
    );
  }

  if (summary.emailErrors.length > 0) {
    const errorList = summary.emailErrors
      .map((e) => `  - \`${e.userId.slice(0, 8)}...\` - ${e.error}`)
      .join("\n");
    lines.push(
      `> :email: **${summary.emailErrors.length}** erreur(s) d'envoi d'email\n${errorList}`,
    );
  }

  if (summary.errors.length > 0) {
    const errorList = summary.errors
      .map((e) => `  - \`${e.userId.slice(0, 8)}...\` - ${e.error}`)
      .join("\n");
    lines.push(`> :x: **${summary.errors.length}** erreur(s)\n${errorList}`);
  }

  if (
    summary.usersDeleted.length === 0 &&
    summary.emailErrors.length === 0 &&
    summary.errors.length === 0
  ) {
    lines.push(`> Aucun compte à supprimer aujourd'hui :white_check_mark:`);
  }

  return lines.join("\n\n");
}
