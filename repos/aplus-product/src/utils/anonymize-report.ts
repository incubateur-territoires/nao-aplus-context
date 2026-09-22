import { fakerFR as faker } from "@faker-js/faker";

// ============================================================================
// Générateurs de données factices pour l'anonymisation des signalements
//
// Source unique partagée entre le runtime (cron reports/deletion) et les
// scripts d'ops (prisma/script/anonymize-helpers.ts re-exporte d'ici).
// ============================================================================

export const GENERIC_SUBJECTS = [
  "Problème d'accès aux droits sociaux",
  "Difficulté administrative avec un organisme public",
  "Demande de régularisation de situation",
  "Blocage dans une procédure administrative",
  "Retard de traitement de dossier",
  "Erreur dans un document administratif",
  "Demande d'accompagnement pour démarches",
  "Problème de communication avec l'administration",
  "Contestation de décision administrative",
  "Demande d'information sur les droits",
];

export function generateFirstName(): string {
  return faker.person.firstName();
}

export function generateLastName(): string {
  return faker.person.lastName();
}

export function generateBirthDate(original: string): string {
  let originalDate: Date | null = null;
  const useFrenchFormat = original?.includes("/");

  if (original) {
    if (useFrenchFormat) {
      const parts = original.split("/");
      if (parts.length === 3) {
        const [day, month, year] = parts;
        originalDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
        );
      }
    } else {
      originalDate = new Date(original);
    }
  }

  if (!originalDate || isNaN(originalDate.getTime())) {
    originalDate = faker.date.birthdate({ min: 18, max: 80, mode: "age" });
  }

  const offsetDays = faker.number.int({ min: -730, max: 730 });
  const newDate = new Date(originalDate);
  newDate.setDate(newDate.getDate() + offsetDays);

  if (useFrenchFormat || !original) {
    const day = String(newDate.getDate()).padStart(2, "0");
    const month = String(newDate.getMonth() + 1).padStart(2, "0");
    const year = newDate.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return newDate.toISOString().split("T")[0];
}

export function generatePhone(): string {
  const prefix = faker.helpers.arrayElement(["06", "07"]);
  const suffix = faker.string.numeric(8);
  return `${prefix}${suffix}`;
}

function mod97(numStr: string): number {
  let remainder = 0;
  for (const digit of numStr) {
    remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
  }
  return remainder;
}

export function generateNIR(): string {
  const sexe = faker.helpers.arrayElement(["1", "2"]);
  const annee = faker.string.numeric(2);
  const mois = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const departement = String(faker.number.int({ min: 1, max: 95 })).padStart(
    2,
    "0",
  );
  const commune = String(faker.number.int({ min: 1, max: 999 })).padStart(
    3,
    "0",
  );
  const ordre = String(faker.number.int({ min: 1, max: 999 })).padStart(3, "0");

  const baseNumber = `${sexe}${annee}${mois}${departement}${commune}${ordre}`;
  const key = 97 - mod97(baseNumber);
  const cle = String(key).padStart(2, "0");

  return `${baseNumber}${cle}`;
}

export function generateCAF(): string {
  return faker.string.numeric(7);
}

export function generateNIF(): string {
  return faker.string.numeric(13);
}

export function generateSubject(): string {
  return faker.helpers.arrayElement(GENERIC_SUBJECTS);
}

export function generateDescription(): string {
  return faker.lorem.paragraphs({ min: 2, max: 4 }, "\n\n");
}

export function generateAnswerContent(): string {
  return faker.lorem.paragraphs({ min: 1, max: 3 }, "\n\n");
}

// ============================================================================
// Composite helpers
// ============================================================================

export interface AnonymizedReportData {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string | null;
  nir: string | null;
  caf: string | null;
  nif: string | null;
  subject: string;
  description: string;
}

/**
 * Génère les données anonymisées d'un signalement (hors `maritalName`).
 * Conservé pour la compatibilité des scripts d'import existants.
 */
export function anonymizeReportRow(original: {
  birthDate: string;
  phone: string | null;
  nir: string | null;
  caf: string | null;
  nif: string | null;
}): AnonymizedReportData {
  return {
    firstName: generateFirstName(),
    lastName: generateLastName(),
    birthDate: generateBirthDate(original.birthDate),
    phone: original.phone ? generatePhone() : null,
    nir: original.nir ? generateNIR() : null,
    caf: original.caf ? generateCAF() : null,
    nif: original.nif ? generateNIF() : null,
    subject: generateSubject(),
    description: generateDescription(),
  };
}

export interface FullAnonymizedReportData extends AnonymizedReportData {
  maritalName: string | null;
}

/**
 * Génère les données anonymisées complètes d'un signalement, incluant
 * `maritalName`. À utiliser pour l'effacement RGPD (cron reports/deletion) afin
 * que tous les champs PII du modèle `Report` soient couverts.
 */
export function buildAnonymizedReportData(original: {
  birthDate: string;
  phone: string | null;
  nir: string | null;
  caf: string | null;
  nif: string | null;
  maritalName: string | null;
}): FullAnonymizedReportData {
  return {
    ...anonymizeReportRow(original),
    maritalName: original.maritalName ? generateLastName() : null,
  };
}
