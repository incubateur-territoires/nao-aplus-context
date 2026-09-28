import { readCsvTable } from "@/utils/csv";
import {
  GOLDEN_TAG_AXES,
  type GoldenTagAxis,
} from "@/utils/golden-dataset-golden-tags";
import type { AxisTags, ScoringItem } from "@/utils/golden-dataset-scoring";
import { splitCorpus } from "@/utils/golden-dataset-split";

/**
 * Lecture des exports CSV des tables du golden dataset pour l'évaluation en
 * local. Les en-têtes sont les noms de colonnes Prisma.
 */

export const GOLDEN_EXPORT_TABLES = {
  items: "GoldenDatasetItem",
  golds: "GoldenDatasetGold",
  annotations: "GoldenDatasetAnnotation",
} as const;

export type GoldenExportTable =
  (typeof GOLDEN_EXPORT_TABLES)[keyof typeof GOLDEN_EXPORT_TABLES];

export interface CsvFile {
  readonly fileName: string;
  readonly text: string;
}

/** Accepte `GoldenDatasetItem.csv` comme `GoldenDatasetItem_202609241200.csv`. */
export function findExport(
  fileNames: readonly string[],
  table: GoldenExportTable,
  dir: string,
): string {
  const matches = fileNames.filter(
    (name) =>
      name.toLowerCase().endsWith(".csv") &&
      name.startsWith(table) &&
      !/[A-Za-z]/.test(name.charAt(table.length)),
  );

  if (matches.length === 0) {
    throw new Error(`Export ${table} introuvable dans ${dir} (${table}*.csv).`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Plusieurs exports ${table} dans ${dir} : ${matches.join(", ")}. N'en garder qu'un.`,
    );
  }

  return matches[0];
}

export interface BlindSourceRow {
  readonly id: string;
  readonly organization: string;
  readonly subject: string;
  readonly description: string;
}

const BLIND_COLUMNS = ["id", "organization", "subject", "description"] as const;

/** Seules les colonnes qu'un modèle a le droit de voir sortent du fichier. */
export function readBlindSources(file: CsvFile): BlindSourceRow[] {
  const rows = readCsvTable(file.text, file.fileName, BLIND_COLUMNS);
  assertUniqueIds(rows, file.fileName);
  return rows;
}

function assertUniqueIds(
  rows: readonly { readonly id: string }[],
  fileName: string,
): void {
  const seen = new Set<string>();
  for (const { id } of rows) {
    if (seen.has(id)) {
      throw new Error(`${fileName} : l'item ${id} apparaît deux fois.`);
    }
    seen.add(id);
  }
}

function emptyToNull(value: string): string | null {
  return value.trim().length === 0 ? null : value;
}

export interface GoldenExports {
  readonly items: CsvFile;
  readonly golds: CsvFile;
  readonly annotations: CsvFile;
}

export interface EvalCorpus {
  readonly items: readonly ScoringItem[];
  /** Lignes de golds ou d'annotations dont l'item manque à l'export des items. */
  readonly orphanRows: number;
}

export function buildEvalCorpus(
  exports: GoldenExports,
  taxonomyVersion: number,
): EvalCorpus {
  const items = readCsvTable(exports.items.text, exports.items.fileName, [
    "id",
    "organization",
    "goldenBlockageTag",
    "goldenProcedureTag",
  ]);
  assertUniqueIds(items, exports.items.fileName);
  const known = new Set(items.map((item) => item.id));
  let orphanRows = 0;

  const closedGolds = new Map<string, AxisTags>();
  const goldRows = readCsvTable(exports.golds.text, exports.golds.fileName, [
    "itemId",
    "taxonomyVersion",
    "blockageTag",
    "procedureTag",
  ]);
  for (const row of goldRows) {
    if (Number(row.taxonomyVersion) !== taxonomyVersion) continue;
    if (!known.has(row.itemId)) {
      orphanRows += 1;
      continue;
    }
    closedGolds.set(row.itemId, {
      blockageTag: row.blockageTag,
      procedureTag: row.procedureTag,
    });
  }

  const annotatorTags = new Map<string, Record<GoldenTagAxis, string[]>>();
  const annotationRows = readCsvTable(
    exports.annotations.text,
    exports.annotations.fileName,
    ["itemId", "blockageTag", "procedureTag"],
  );
  for (const row of annotationRows) {
    if (!known.has(row.itemId)) {
      orphanRows += 1;
      continue;
    }
    const tags = annotatorTags.get(row.itemId) ?? {
      blockageTag: [],
      procedureTag: [],
    };
    for (const axis of GOLDEN_TAG_AXES) {
      const tag = emptyToNull(row[axis]);
      if (tag !== null) tags[axis].push(tag);
    }
    annotatorTags.set(row.itemId, tags);
  }

  const splits = splitCorpus(items);

  return {
    orphanRows,
    items: items.map((item) => ({
      id: item.id,
      split: splits.get(item.id)!,
      fineGolds: {
        blockageTag: emptyToNull(item.goldenBlockageTag),
        procedureTag: emptyToNull(item.goldenProcedureTag),
      },
      closedGolds: closedGolds.get(item.id) ?? null,
      annotatorTags: annotatorTags.get(item.id) ?? {
        blockageTag: [],
        procedureTag: [],
      },
    })),
  };
}
