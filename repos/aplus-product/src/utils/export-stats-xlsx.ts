/**
 * Export XLSX d'une série de statistiques (deux colonnes : le libellé et sa
 * valeur). S'appuie sur SheetJS (`xlsx`), déjà présent dans le projet.
 */

import * as XLSX from "xlsx";
import { formatPercentage, sumValues } from "@/utils/stats-percentage";
import type { StatsColumnHeaders } from "@/types/stats";

/**
 * Construit le tableau de cellules (AOA) de la feuille : en-tête + lignes.
 * Avec `includePercentage`, une colonne « Part » (pourcentage de chaque valeur
 * dans le total) est ajoutée — utile pour les diagrammes circulaires (donut).
 */
export function buildStatsSheetData(
  labels: string[],
  values: number[],
  headers: StatsColumnHeaders,
  includePercentage = false,
): (string | number)[][] {
  if (!includePercentage) {
    return [
      [headers.label, headers.value],
      ...labels.map((label, index) => [label, values[index] ?? 0]),
    ];
  }

  const total = sumValues(values);
  return [
    [headers.label, headers.value, "Part"],
    ...labels.map((label, index) => {
      const value = values[index] ?? 0;
      return [label, value, formatPercentage(value, total)];
    }),
  ];
}

export function exportStatsXlsx(
  filename: string,
  labels: string[],
  values: number[],
  headers: StatsColumnHeaders,
  includePercentage = false,
): void {
  const [header, ...rows] = buildStatsSheetData(
    labels,
    values,
    headers,
    includePercentage,
  );
  exportTableXlsx(filename, header, rows);
}

// Marge ajoutée à la cellule la plus longue d'une colonne, en caractères : le
// tableur rend le texte un peu plus large que ne le laisse croire ce décompte
// (séparateurs de milliers, gras de l'en-tête).
const COLUMN_PADDING = 2;

// Au-delà, la colonne devient plus encombrante que lisible : le tableur
// coupera l'affichage, et l'utilisateur pourra l'élargir lui-même.
const MAX_COLUMN_WIDTH = 60;

/**
 * Largeur de chaque colonne, en caractères (unité `wch` de SheetJS), calée sur
 * sa cellule la plus longue. Sans cela, toute colonne garde la largeur par
 * défaut du tableur et un en-tête un peu long — « Nombre de signalements » —
 * déborde sur la cellule voisine à l'ouverture du fichier.
 */
export function computeColumnWidths(
  data: (string | number)[][],
): { wch: number }[] {
  const widths: number[] = [];
  for (const row of data) {
    row.forEach((cell, index) => {
      const length = String(cell ?? "").length;
      widths[index] = Math.max(widths[index] ?? 0, length);
    });
  }
  return widths.map((width) => ({
    wch: Math.min(width + COLUMN_PADDING, MAX_COLUMN_WIDTH),
  }));
}

/**
 * Export XLSX générique d'un tableau (ligne d'en-tête + lignes de données) —
 * utilisé notamment par le tableau « Délais de prise en charge ».
 */
export function exportTableXlsx(
  filename: string,
  header: (string | number)[],
  rows: (string | number)[][],
): void {
  const data = [header, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet["!cols"] = computeColumnWidths(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Statistiques");
  XLSX.writeFile(
    workbook,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}
