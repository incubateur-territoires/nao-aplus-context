import type { EmailBatchOutcome } from "@/app/services/email/email-batch";
import type { TemplateKey } from "@/app/services/email/email.template";
import { sentryDetailLabel } from "@/utils/sentry-url";

// Des compteurs seulement : lister les signalements dépassait la taille maximale
// d'un post. Les identifiants sont dans les logs, les échecs d'e-mail dans Sentry.
function buildEmailFailureLine(
  emails: EmailBatchOutcome,
  template: TemplateKey,
): string {
  if (emails.failures.length === 0) return "";

  return `\n\n> :email: **${emails.failures.length}** échec(s) d'envoi d'e-mail sur ${emails.sent.length + emails.failures.length} tentative(s) — ${sentryDetailLabel(`template:${template}`)}`;
}

export function buildOverdueReportsMessage(
  reportCount: number,
  emails: EmailBatchOutcome,
): string {
  return `**CRON - Signalements en souffrance**

> **${reportCount}** signalement(s) viennent d'être marqués "En souffrance"${buildEmailFailureLine(emails, "REPORT_OVERDUE")}`;
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
  reportCount: number,
  emails: EmailBatchOutcome,
): string {
  return `**CRON - Fermeture automatique de signalements**

> **${reportCount}** signalement(s) traité(s) depuis plus de 30 jours ont été automatiquement fermés${buildEmailFailureLine(emails, "REPORT_AUTO_CLOSED")}`;
}

export function buildNoAutoClosedReportsMessage(): string {
  return `**CRON - Fermeture automatique de signalements**

> Aucun signalement à fermer automatiquement aujourd'hui :white_check_mark:`;
}

export interface ReportDeletionSummary {
  reportsDeleted: { id: string }[];
  pseudonymized?: { id: string }[];
  awaitingPseudonymization?: { id: string }[];
  awaitingPseudonymizationCount?: number;
  contentErased?: { id: string }[];
  pseudonymizationOutage?: boolean;
  pseudonymizationEnabled: boolean;
  fileErrors: { reportId: string; fileId: string; error: string }[];
  errors: { reportId: string; error: string }[];
}

export function buildDeletedReportsMessage(
  summary: ReportDeletionSummary,
): string {
  const lines: string[] = [
    "**CRON - Suppression de signalements (6 mois après fermeture)**",
  ];

  // Des compteurs seulement : une liste d'identifiants rendait le message
  // illisible au-delà de quelques dizaines, et le détail est dans Sentry.
  const failures = summary.errors.length + summary.fileErrors.length;
  if (failures > 0) {
    lines.push(
      `> :x: **${summary.errors.length}** erreur(s) de suppression · **${summary.fileErrors.length}** fichier(s) non supprimé(s) — ${sentryDetailLabel("cron:reports/deletion")}`,
    );
  }

  if (summary.reportsDeleted.length > 0) {
    lines.push(
      `> :wastebasket: **${summary.reportsDeleted.length}** signalement(s) anonymisé(s) et supprimé(s)`,
    );
  }

  const pseudonymized = summary.pseudonymized?.length ?? 0;
  const awaiting =
    summary.awaitingPseudonymizationCount ??
    summary.awaitingPseudonymization?.length ??
    0;
  const erased = summary.contentErased?.length ?? 0;

  // Drapeau éteint, le texte est remplacé comme il l'a toujours été : la ligne
  // n'apporterait qu'un compteur de « remplacés » égal aux supprimés.
  const textWorthMentioning =
    summary.pseudonymizationEnabled &&
    (pseudonymized > 0 || awaiting > 0 || erased > 0);

  if (textWorthMentioning) {
    lines.push(
      `> :lock: Texte : **${pseudonymized}** caviardé(s) · **${awaiting}** en attente · **${erased}** remplacé(s)`,
    );
  }

  // L'alerte porte sur le stock en attente, pas sur un dossier : c'est lui qui
  // dit l'ampleur d'une indisponibilité, et il est la seule chose à surveiller.
  if (summary.pseudonymizationOutage) {
    lines.push(
      `> :rotating_light: **Pipeline de caviardage indisponible.** Le masquage des signalements a bien eu lieu, mais **${awaiting}** texte(s) attendent d'être caviardés. Aucun contenu n'a été remplacé pour cette raison.`,
    );
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
