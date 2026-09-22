/**
 * Calcul et formatage des parts (pourcentages) d'une série de statistiques.
 *
 * Les diagrammes circulaires (donut) et leurs tableaux sont évalués en
 * pourcentage : ces helpers centralisent le calcul de la part de chaque valeur
 * dans le total et son formatage au format français (« 45,6 % »).
 */

/** Somme d'une série de valeurs. */
export function sumValues(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Formate la part d'une valeur dans le total au format français (« 45,6 % »),
 * arrondie à une décimale. Retourne « 0 % » si le total est nul.
 */
export function formatPercentage(value: number, total: number): string {
  if (total === 0) return "0 %";
  const percentage = Math.round((value / total) * 1000) / 10;
  return `${percentage.toLocaleString("fr-FR")} %`;
}
