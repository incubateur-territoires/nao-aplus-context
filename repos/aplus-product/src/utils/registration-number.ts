/**
 * Les matricules France Services sont numériques (1 à 4 chiffres à ce jour) ;
 * 6 chiffres laissent de la marge, valeurs de remplacement comprises.
 */
const REGISTRATION_NUMBER_PATTERN = /^\d{1,6}$/;

export const REGISTRATION_NUMBER_REQUIRED_MESSAGE =
  "Le matricule est obligatoire pour France Services.";

export const REGISTRATION_NUMBER_FORMAT_MESSAGE =
  "Le matricule ne doit contenir que des chiffres (6 au maximum).";

export function isValidRegistrationNumber(value: string): boolean {
  return REGISTRATION_NUMBER_PATTERN.test(value);
}
