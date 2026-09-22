/**
 * Palette catégorielle des web-components `@gouvfr/dsfr-chart`.
 *
 * dsfr-chart n'expose ni attribut de couleurs ni variables CSS : les palettes
 * sont codées en dur dans son bundle (`dist/DSFRChart/DSFRChart.js`). La palette
 * « categorical » (par défaut) utilise les couleurs 01 → 08, la couleur d'une
 * tranche de donut ou d'une série de barres d'index i étant `palette[i % 8]`,
 * et le thème étant lu sur l'attribut `data-fr-theme` de `<html>`.
 *
 * On duplique ces valeurs pour rendre une légende maison dont les carrés de
 * couleur correspondent exactement au graphique.
 *
 * ⚠️ Valeurs relevées dans dsfr-chart 2.1.1 (version épinglée dans
 * package.json) — à revalider à toute montée de version de la librairie.
 */

export type ChartTheme = "light" | "dark";

const CATEGORICAL_PALETTES: Record<ChartTheme, string[]> = {
  light: [
    "#5C68E5",
    "#82B5F2",
    "#29598F",
    "#31A7AE",
    "#81EEF5",
    "#B478F1",
    "#CFB1F5",
    "#CECECE",
  ],
  dark: [
    "#5C68E5",
    "#699BD6",
    "#4878B1",
    "#00828A",
    "#51C1C8",
    "#BC8AF2",
    "#CFB1F5",
    "#A4A4A4",
  ],
};

/**
 * Thème courant, lu comme le fait dsfr-chart (`data-fr-theme` sur `<html>`).
 * Repli sur « light » côté serveur ou si l'attribut est absent/inconnu.
 */
export function getChartTheme(): ChartTheme {
  if (typeof document === "undefined") return "light";
  const theme = document.documentElement.getAttribute("data-fr-theme");
  return theme === "dark" ? "dark" : "light";
}

/**
 * Couleur de la série/tranche `index`, identique à celle que dsfr-chart
 * attribuera (`palette[index % 8]`).
 */
export function getSeriesColor(index: number, theme?: ChartTheme): string {
  const palette = CATEGORICAL_PALETTES[theme ?? getChartTheme()];
  return palette[index % palette.length];
}
