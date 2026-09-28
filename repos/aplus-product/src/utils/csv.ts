/**
 * Lecture des exports CSV de tables (séparateur « ; » par défaut, champs entre
 * guillemets, `""` pour un guillemet). Un champ entre guillemets peut contenir
 * des retours à la ligne : on ne découpe donc jamais le fichier par ligne.
 */

export function parseCsv(text: string, separator = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const source = text.startsWith("﻿") ? text.slice(1) : text;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = false;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error("guillemet ouvrant sans guillemet fermant");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.length > 1 || cells[0] !== "");
}

export type CsvRecord<Column extends string> = {
  readonly [C in Column]: string;
};

/**
 * Ne rend que les colonnes demandées : une colonne non nommée ici ne sort pas
 * de la fonction, quel que soit le contenu du fichier.
 */
export function readCsvTable<Column extends string>(
  text: string,
  fileName: string,
  columns: readonly Column[],
): CsvRecord<Column>[] {
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (error) {
    throw new Error(
      `${fileName} : CSV illisible (${(error as Error).message}).`,
    );
  }

  const [header, ...body] = rows;
  if (header === undefined) {
    throw new Error(`${fileName} : fichier vide, ligne d'en-tête attendue.`);
  }

  const indexes = columns.map((column) => {
    const index = header.indexOf(column);
    if (index === -1) {
      throw new Error(
        `${fileName} : colonne « ${column} » absente de l'en-tête (${header.join(", ")}).`,
      );
    }
    return index;
  });

  return body.map((cells, rowIndex) => {
    if (cells.length !== header.length) {
      throw new Error(
        `${fileName} : ligne ${rowIndex + 2}, ${cells.length} champs pour ${header.length} colonnes.`,
      );
    }
    return Object.fromEntries(
      columns.map((column, i) => [column, cells[indexes[i]]]),
    ) as CsvRecord<Column>;
  });
}
