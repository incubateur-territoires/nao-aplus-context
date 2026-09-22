/**
 * Normalise une chaîne pour la recherche :
 * - mise en minuscules
 * - suppression des accents/diacritiques
 * - suppression des espaces en début/fin
 */
export function normalizeSearchQuery(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Normalise une adresse e-mail pour le stockage et la comparaison :
 * - suppression des espaces en d\u00e9but/fin
 * - mise en minuscules
 *
 * Ne retire PAS les accents (contrairement \u00e0 `normalizeSearchQuery`) :
 * un accent fait partie int\u00e9grante de l'adresse et ne doit pas \u00eatre alt\u00e9r\u00e9.
 */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
