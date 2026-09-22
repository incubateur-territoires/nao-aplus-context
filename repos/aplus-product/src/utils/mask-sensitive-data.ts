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

export function maskReportForRole<T extends Record<string, unknown>>(
  report: T,
  userRole?: UserRole,
): T {
  if (!shouldMaskSensitiveData(userRole)) return report;

  const masked = { ...report };

  for (const field of REPORT_SENSITIVE_STRING_FIELDS) {
    if (field in masked && masked[field] !== null) {
      (masked as Record<string, unknown>)[field] = maskValue(
        field,
        masked[field],
      );
    }
  }

  if ("files" in masked && Array.isArray(masked.files)) {
    (masked as Record<string, unknown>).files = maskFilesForRole(
      masked.files as Record<string, unknown>[],
      userRole,
    );
  }

  if ("answers" in masked && Array.isArray(masked.answers)) {
    (masked as Record<string, unknown>).answers = maskAnswersForRole(
      masked.answers as Record<string, unknown>[],
      userRole,
    );
  }

  return masked;
}

export function maskReportsForRole<T extends Record<string, unknown>>(
  reports: T[],
  userRole?: UserRole,
): T[] {
  if (!shouldMaskSensitiveData(userRole)) return reports;
  return reports.map((report) => maskReportForRole(report, userRole));
}

export function maskAnswerForRole<T extends Record<string, unknown>>(
  answer: T,
  userRole?: UserRole,
): T {
  if (!shouldMaskSensitiveData(userRole)) return answer;

  const masked = { ...answer };

  if ("content" in masked && masked.content !== null) {
    (masked as Record<string, unknown>).content = maskValue(
      "contenu",
      masked.content,
    );
  }

  if ("files" in masked && Array.isArray(masked.files)) {
    (masked as Record<string, unknown>).files = maskFilesForRole(
      masked.files as Record<string, unknown>[],
      userRole,
    );
  }

  return masked;
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

export function maskAnswersForRole<T extends Record<string, unknown>>(
  answers: T[],
  userRole?: UserRole,
): T[] {
  if (!shouldMaskSensitiveData(userRole)) return answers;
  return answers.map((answer) => maskAnswerForRole(answer, userRole));
}
