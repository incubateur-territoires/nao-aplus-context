import { isAdmin, isSupervisor } from "@/utils/auth";
import { USER_ROLES, UserRole } from "@/constants/user-roles";

const FIELD_LABELS: Record<string, string> = {
  subject: "Sujet",
  description: "Description",
  caf: "CAF",
  nir: "NIR",
  nif: "NIF",
  firstName: "Prénom",
  lastName: "Nom",
  maritalName: "Nom marital",
  phone: "Téléphone",
};

function maskValue(field: string, value: unknown): string {
  const label = FIELD_LABELS[field] ?? field;
  const length = typeof value === "string" ? value.length : 0;
  return `${label} (${length} caractère${length > 1 ? "s" : ""})`;
}

export function getMaskingRole(
  userRole: UserRole | undefined,
  impersonatedBy?: string | null,
): UserRole | undefined {
  if (impersonatedBy) return USER_ROLES.ADMIN;
  return userRole;
}

function shouldMaskSensitiveData(role?: UserRole): boolean {
  return isAdmin(role) || isSupervisor(role);
}

/** Un admin lit le texte caviardé quand il existe, plutôt que sa seule longueur. */
function showsPseudonymizedText(role?: UserRole): boolean {
  return isAdmin(role);
}

interface WithPseudonymizedReport {
  pseudonymized?: { subject: string; description: string } | null;
}

interface WithPseudonymizedAnswer {
  pseudonymized?: { content: string } | null;
}

const REPORT_SENSITIVE_STRING_FIELDS = [
  "subject",
  "description",
  "caf",
  "nir",
  "nif",
  "firstName",
  "lastName",
  "maritalName",
  "phone",
] as const;

export function maskReportForRole<
  T extends Record<string, unknown> & WithPseudonymizedReport,
>(report: T, userRole?: UserRole): Omit<T, "pseudonymized"> {
  const { pseudonymized, ...rest } = report;
  const masked: Record<string, unknown> = { ...rest };

  if (shouldMaskSensitiveData(userRole)) {
    for (const field of REPORT_SENSITIVE_STRING_FIELDS) {
      if (field in masked && masked[field] !== null) {
        masked[field] = maskValue(field, masked[field]);
      }
    }

    if (showsPseudonymizedText(userRole) && pseudonymized) {
      masked.subject = pseudonymized.subject;
      masked.description = pseudonymized.description;
    }

    if (Array.isArray(masked.files)) {
      masked.files = maskFilesForRole(
        masked.files as Record<string, unknown>[],
        userRole,
      );
    }
  }

  if (Array.isArray(masked.answers)) {
    masked.answers = maskAnswersForRole(
      masked.answers as Record<string, unknown>[],
      userRole,
    );
  }

  return masked as Omit<T, "pseudonymized">;
}

export function maskReportsForRole<
  T extends Record<string, unknown> & WithPseudonymizedReport,
>(reports: T[], userRole?: UserRole): Omit<T, "pseudonymized">[] {
  return reports.map((report) => maskReportForRole(report, userRole));
}

export function maskAnswerForRole<
  T extends Record<string, unknown> & WithPseudonymizedAnswer,
>(answer: T, userRole?: UserRole): Omit<T, "pseudonymized"> {
  const { pseudonymized, ...rest } = answer;
  const masked: Record<string, unknown> = { ...rest };

  if (!shouldMaskSensitiveData(userRole)) {
    return masked as Omit<T, "pseudonymized">;
  }

  if ("content" in masked && masked.content !== null) {
    masked.content =
      showsPseudonymizedText(userRole) && pseudonymized
        ? pseudonymized.content
        : maskValue("contenu", masked.content);
  }

  if (Array.isArray(masked.files)) {
    masked.files = maskFilesForRole(
      masked.files as Record<string, unknown>[],
      userRole,
    );
  }

  return masked as Omit<T, "pseudonymized">;
}

function maskFileForRole<T extends Record<string, unknown>>(
  file: T,
  userRole?: UserRole,
): T {
  if (!shouldMaskSensitiveData(userRole)) return file;

  const masked = { ...file };

  if ("name" in masked && masked.name !== null) {
    (masked as Record<string, unknown>).name = maskValue(
      "Fichier",
      masked.name,
    );
  }

  return masked;
}

function maskFilesForRole<T extends Record<string, unknown>>(
  files: T[],
  userRole?: UserRole,
): T[] {
  if (!shouldMaskSensitiveData(userRole)) return files;
  return files.map((file) => maskFileForRole(file, userRole));
}

export function maskAnswersForRole<
  T extends Record<string, unknown> & WithPseudonymizedAnswer,
>(answers: T[], userRole?: UserRole): Omit<T, "pseudonymized">[] {
  return answers.map((answer) => maskAnswerForRole(answer, userRole));
}
