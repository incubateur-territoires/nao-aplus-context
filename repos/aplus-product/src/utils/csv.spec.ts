import { parseCsv, readCsvTable } from "./csv";

describe("parseCsv", () => {
  it("découpe sur le point-virgule et retire les guillemets", () => {
    expect(parseCsv('"a";"b"\n"1";"2"\n')).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("garde les retours à la ligne et les séparateurs dans un champ entre guillemets", () => {
    expect(parseCsv('"id";"texte"\n"1";"ligne un\nligne; deux"\n')).toEqual([
      ["id", "texte"],
      ["1", "ligne un\nligne; deux"],
    ]);
  });

  it("relit un guillemet doublé comme un guillemet", () => {
    expect(parseCsv('"x"\n"il a dit ""non"""')).toEqual([
      ["x"],
      ['il a dit "non"'],
    ]);
  });

  it("accepte CRLF, un BOM et des champs sans guillemets", () => {
    expect(parseCsv("﻿a;b\r\n1;\r\n")).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
  });

  it("refuse un guillemet jamais refermé", () => {
    expect(() => parseCsv('"a\n')).toThrow(/guillemet/);
  });
});

describe("readCsvTable", () => {
  const text = '"id";"secret";"organization"\n"i1";"caché";"CAF"\n';

  it("ne rend que les colonnes demandées", () => {
    expect(readCsvTable(text, "items.csv", ["id", "organization"])).toEqual([
      { id: "i1", organization: "CAF" },
    ]);
  });

  it("nomme le fichier et la colonne absente", () => {
    expect(() => readCsvTable(text, "items.csv", ["id", "subject"])).toThrow(
      /items\.csv.*« subject »/,
    );
  });

  it("refuse une ligne au nombre de champs incohérent", () => {
    expect(() => readCsvTable('"id";"a"\n"1"\n', "items.csv", ["id"])).toThrow(
      /items\.csv : ligne 2/,
    );
  });

  it("refuse un fichier vide", () => {
    expect(() => readCsvTable("", "items.csv", ["id"])).toThrow(/vide/);
  });
});
