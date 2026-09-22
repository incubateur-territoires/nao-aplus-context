import { formatPercentage, sumValues } from "./stats-percentage";

describe("stats-percentage", () => {
  describe("sumValues", () => {
    it("additionne les valeurs", () => {
      expect(sumValues([12, 5, 3])).toBe(20);
    });

    it("retourne 0 pour une série vide", () => {
      expect(sumValues([])).toBe(0);
    });
  });

  describe("formatPercentage", () => {
    it("formate la part au format français avec une décimale", () => {
      expect(formatPercentage(12, 17)).toBe("70,6 %");
      expect(formatPercentage(5, 17)).toBe("29,4 %");
    });

    it("n'affiche pas de décimale superflue", () => {
      expect(formatPercentage(15, 20)).toBe("75 %");
    });

    it("retourne « 0 % » quand le total est nul", () => {
      expect(formatPercentage(0, 0)).toBe("0 %");
    });
  });
});
