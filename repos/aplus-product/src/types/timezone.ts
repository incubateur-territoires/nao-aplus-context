import { z } from "zod";

export const FRENCH_TIMEZONES = {
  EUROPE_PARIS: "Europe/Paris",
  AMERICA_MARTINIQUE: "America/Martinique",
  AMERICA_CAYENNE: "America/Cayenne",
  INDIAN_REUNION: "Indian/Reunion",
  INDIAN_MAYOTTE: "Indian/Mayotte",
  PACIFIC_NOUMEA: "Pacific/Noumea",
  PACIFIC_TAHITI: "Pacific/Tahiti",
  AMERICA_MIQUELON: "America/Miquelon",
  PACIFIC_WALLIS: "Pacific/Wallis",
} as const;

export type FrenchTimezone =
  (typeof FRENCH_TIMEZONES)[keyof typeof FRENCH_TIMEZONES];

export const FrenchTimezoneSchema = z.enum([
  "Europe/Paris",
  "America/Martinique",
  "America/Cayenne",
  "Indian/Reunion",
  "Indian/Mayotte",
  "Pacific/Noumea",
  "Pacific/Tahiti",
  "America/Miquelon",
  "Pacific/Wallis",
]);

// Mapping INSEE code -> timezone pour DOM-TOM
export const INSEE_CODE_TO_TIMEZONE: Record<string, FrenchTimezone> = {
  "971": "America/Martinique", // Guadeloupe
  "972": "America/Martinique", // Martinique
  "973": "America/Cayenne", // Guyane
  "974": "Indian/Reunion", // La Réunion
  "975": "America/Miquelon", // Saint-Pierre-et-Miquelon
  "976": "Indian/Mayotte", // Mayotte
  "986": "Pacific/Wallis", // Wallis-et-Futuna
  "987": "Pacific/Tahiti", // Polynésie française
  "988": "Pacific/Noumea", // Nouvelle-Calédonie
};

export function getTimezoneFromInseeCode(inseeCode: string): FrenchTimezone {
  return INSEE_CODE_TO_TIMEZONE[inseeCode] ?? "Europe/Paris";
}
