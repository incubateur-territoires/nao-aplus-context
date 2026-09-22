import * as XLSX from "xlsx";
import {
  buildStatsSheetData,
  computeColumnWidths,
  exportStatsXlsx,
  exportTableXlsx,
} from "./export-stats-xlsx";

jest.mock("xlsx", () => ({
  utils: {
    aoa_to_sheet: jest.fn(() => ({})),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  writeFile: jest.fn(),
}));

const HEADERS = { label: "État", value: "Nombre de signalements" };

describe("export-stats-xlsx", () => {
  describe("buildStatsSheetData", () => {
    it("nomme les colonnes d'après les en-têtes de la série", () => {
      expect(
        buildStatsSheetData(["Traité", "Fermé"], [12, 5], HEADERS),
      ).toEqual([
        ["État", "Nombre de signalements"],
        ["Traité", 12],
        ["Fermé", 5],
      ]);
    });

    it("remplace les valeurs manquantes par 0", () => {
      expect(buildStatsSheetData(["A", "B"], [3], HEADERS)).toEqual([
        ["État", "Nombre de signalements"],
        ["A", 3],
        ["B", 0],
      ]);
    });

    it("ajoute une colonne Part quand includePercentage est vrai", () => {
      expect(
        buildStatsSheetData(["Traité", "Fermé"], [15, 5], HEADERS, true),
      ).toEqual([
        ["État", "Nombre de signalements", "Part"],
        ["Traité", 15, "75 %"],
        ["Fermé", 5, "25 %"],
      ]);
    });
  });

  describe("computeColumnWidths", () => {
    it("cale chaque colonne sur sa cellule la plus longue", () => {
      expect(
        computeColumnWidths([
          ["Date", "Nombre de signalements"],
          ["mars 2026", 10],
        ]),
      ).toEqual([{ wch: "mars 2026".length + 2 }, { wch: 22 + 2 }]);
    });

    it("plafonne les colonnes très longues", () => {
      const [column] = computeColumnWidths([["x".repeat(200)]]);
      expect(column).toEqual({ wch: 60 });
    });
  });

  describe("exportStatsXlsx", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("écrit un fichier .xlsx en ajoutant l'extension si besoin", () => {
      exportStatsXlsx("repartition-par-etat", ["Traité"], [12], HEADERS);

      expect(XLSX.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        "repartition-par-etat.xlsx",
      );
    });

    it("n'ajoute pas d'extension si elle est déjà présente", () => {
      exportStatsXlsx("stats.xlsx", ["A"], [1], HEADERS);

      expect(XLSX.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        "stats.xlsx",
      );
    });
  });

  describe("exportTableXlsx", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("écrit l'en-tête suivi des lignes de données", () => {
      exportTableXlsx(
        "delais",
        ["Équipe", "Total"],
        [
          ["CAF", 10],
          ["CPAM", 4],
        ],
      );

      expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledWith([
        ["Équipe", "Total"],
        ["CAF", 10],
        ["CPAM", 4],
      ]);
      expect(XLSX.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        "delais.xlsx",
      );
    });

    it("dimensionne les colonnes pour que les en-têtes ne débordent pas", () => {
      const worksheet: Record<string, unknown> = {};
      (XLSX.utils.aoa_to_sheet as jest.Mock).mockReturnValueOnce(worksheet);

      exportTableXlsx(
        "stats",
        ["Date", "Nombre de signalements"],
        [["mars 2026", 10]],
      );

      expect(worksheet["!cols"]).toEqual([{ wch: 11 }, { wch: 24 }]);
    });
  });
});
