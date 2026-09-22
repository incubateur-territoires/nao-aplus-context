/**
 * Valide une date au format `AAAA-MM-JJ` (celui des champs `<input type="date">`
 * et des paramètres d'URL).
 *
 * Le format seul ne suffit pas : « 2026-02-31 » le respecte, mais JS le décale
 * silencieusement au 3 mars au lieu de le rejeter. On compare donc la date
 * reconstituée à la saisie.
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
