import { getChartTheme, getSeriesColor } from "./stats-chart-palette";

describe("stats-chart-palette", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-fr-theme");
  });

  describe("getChartTheme", () => {
    it("retourne « light » quand l'attribut est absent", () => {
      expect(getChartTheme()).toBe("light");
    });

    it("retourne « dark » quand le thème sombre est actif", () => {
      document.documentElement.setAttribute("data-fr-theme", "dark");
      expect(getChartTheme()).toBe("dark");
    });

    it("retombe sur « light » pour une valeur inconnue", () => {
      document.documentElement.setAttribute("data-fr-theme", "system");
      expect(getChartTheme()).toBe("light");
    });
  });

  describe("getSeriesColor", () => {
    it("retourne les couleurs de la palette claire dans l'ordre", () => {
      expect(getSeriesColor(0)).toBe("#5C68E5");
      expect(getSeriesColor(1)).toBe("#82B5F2");
      expect(getSeriesColor(7)).toBe("#CECECE");
    });

    it("boucle sur la palette au-delà de 8 séries (comme dsfr-chart)", () => {
      expect(getSeriesColor(8)).toBe(getSeriesColor(0));
      expect(getSeriesColor(9)).toBe(getSeriesColor(1));
    });

    it("suit le thème sombre", () => {
      document.documentElement.setAttribute("data-fr-theme", "dark");
      expect(getSeriesColor(1)).toBe("#699BD6");
    });

    it("accepte un thème explicite (rendu serveur)", () => {
      document.documentElement.setAttribute("data-fr-theme", "dark");
      expect(getSeriesColor(1, "light")).toBe("#82B5F2");
    });
  });
});
