import { fakerFR as faker } from "@faker-js/faker";

// Les générateurs liés aux signalements vivent désormais dans le runtime
// (`src/utils/anonymize-report.ts`) pour être partagés avec le cron
// reports/deletion. On les re-exporte ici pour ne pas casser les scripts
// existants qui importent depuis `./anonymize-helpers`.
export {
  GENERIC_SUBJECTS,
  generateFirstName,
  generateLastName,
  generateBirthDate,
  generatePhone,
  generateNIR,
  generateCAF,
  generateNIF,
  generateSubject,
  generateDescription,
  generateAnswerContent,
  anonymizeReportRow,
  buildAnonymizedReportData,
} from "@/utils/anonymize-report";
export type {
  AnonymizedReportData,
  FullAnonymizedReportData,
} from "@/utils/anonymize-report";

// ============================================================================
// Constantes
// ============================================================================

// Le mot de passe commun de dev/staging ne vit pas dans le dépôt (public) :
// il vient du .env. Getter paresseux pour que les scripts qui n'en ont pas
// besoin puissent importer ce module sans la variable.
export function getDefaultPassword(): string {
  const devPassword = process.env.NEXT_PUBLIC_DEV_PASSWORD;
  if (!devPassword) {
    throw new Error(
      "NEXT_PUBLIC_DEV_PASSWORD manquant dans le .env — refus de poser un mot de passe vide",
    );
  }
  return devPassword;
}

export const FAKE_DOMAINS = [
  "@administration.fr",
  "@mfs.fr",
  "@msa.fr",
  "@caf.fr",
  "@cpam.fr",
];

// ============================================================================
// User helpers
// ============================================================================

export function normalizeEmail(email: string): string {
  return email
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isFakeUser(email: string): boolean {
  return FAKE_DOMAINS.some((domain) => email.endsWith(domain));
}

export interface PseudonymizedUser {
  firstName: string;
  lastName: string;
  name: string;
  email: string;
}

export function pseudonymizeUserRow(
  originalEmail: string,
  usedEmails: Set<string>,
): PseudonymizedUser {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const domain = originalEmail.split("@")[1] || "example.fr";

  let email = normalizeEmail(`${firstName}.${lastName}@${domain}`);
  let attempt = 0;
  while (usedEmails.has(email)) {
    attempt++;
    email = normalizeEmail(`${firstName}.${lastName}${attempt}@${domain}`);
  }
  usedEmails.add(email);

  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email,
  };
}
