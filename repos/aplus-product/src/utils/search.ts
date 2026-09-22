import prisma from "@/lib/prisma";

export { normalizeSearchQuery } from "./normalize";

const ALLOWED_TABLES: Record<string, readonly string[]> = {
  Report: ["subject", "firstName", "lastName"],
  User: ["firstName", "lastName", "email"],
  PendingUser: ["firstName", "lastName", "email"],
};

// Condition appliquée en amont du LIMIT, pour que les lignes exclues de l'UI
// ne consomment pas de places dans le lot de résultats retourné.
const BASE_CONDITIONS: Record<string, string> = {
  // Les signalements supprimés (soft delete) ne sont jamais recherchables
  Report: `"status" <> 'DELETED'`,
};

/**
 * Recherche des IDs dans une table via unaccent() pour une recherche insensible aux accents.
 * Ex: "melanie" matche "Mélanie"
 *
 * Les noms de table et colonnes sont validés contre une whitelist pour prévenir toute injection SQL.
 * Le terme de recherche est paramétrisé via $1.
 */
export async function searchWithUnaccent(
  table: keyof typeof ALLOWED_TABLES,
  columns: string[],
  search: string,
): Promise<string[]> {
  const allowedColumns = ALLOWED_TABLES[table];
  if (!allowedColumns) {
    throw new Error(`Table "${table}" non autorisée pour searchWithUnaccent`);
  }
  for (const col of columns) {
    if (!allowedColumns.includes(col)) {
      throw new Error(
        `Colonne "${col}" non autorisée pour la table "${table}"`,
      );
    }
  }

  const words = search.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS);
  if (words.length === 0) return [];

  // Each word must match at least one column (AND between words, OR between columns)
  const wordConditions = words.map((_, i) => {
    const param = `$${i + 1}`;
    const colConditions = columns
      .map((col) => `unaccent("${col}") ILIKE unaccent(${param})`)
      .join(" OR ");
    return `(${colConditions})`;
  });

  const baseCondition = BASE_CONDITIONS[table];
  const conditions = baseCondition
    ? [baseCondition, ...wordConditions]
    : wordConditions;

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "${table}" WHERE ${conditions.join(" AND ")} LIMIT 10000`,
    ...words.map((w) => `%${w}%`),
  );

  return rows.map((r) => r.id);
}

const MAX_SEARCH_WORDS = 10;

/**
 * Recherche des IDs d'équipes via unaccent(), incluant les relations (organization, areas).
 * Les noms de tables/colonnes sont hardcodés dans la requête (pas d'interpolation dynamique).
 * Les valeurs de recherche sont paramétrées via $1, $2, etc.
 */
interface SearchTeamsScope {
  areaIds: string[];
  organizationIds: string[];
}

/**
 * Construit la clause WHERE et les paramètres pour une recherche d'équipes avec unaccent.
 * Permet de réutiliser la logique de recherche dans d'autres requêtes (ex: tri + pagination).
 * @param startParamIndex - Index de départ pour les paramètres SQL ($1, $2, etc.)
 */
export function buildTeamSearchConditions(
  search: string,
  scope?: SearchTeamsScope,
  startParamIndex: number = 1,
): { whereSQL: string; params: unknown[] } | null {
  const words = search.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS);
  if (words.length === 0) return null;

  const params: unknown[] = words.map((w) => `%${w}%`);
  let nextParam = startParamIndex + words.length;

  const wordConditions = words.map((_, i) => {
    const param = `$${startParamIndex + i}`;
    return `(
      unaccent(t."name") ILIKE unaccent(${param})
      OR unaccent(COALESCE(t."registrationNumber", '')) ILIKE unaccent(${param})
    )`;
  });

  let scopeSQL = "";
  if (scope) {
    const orgPlaceholders = scope.organizationIds.map(() => {
      const p = `$${nextParam}`;
      nextParam++;
      return p;
    });
    params.push(...scope.organizationIds);
    scopeSQL += ` AND t."organizationId" IN (${orgPlaceholders.join(", ")})`;

    const areaPlaceholders = scope.areaIds.map(() => {
      const p = `$${nextParam}`;
      nextParam++;
      return p;
    });
    params.push(...scope.areaIds);
    scopeSQL += ` AND EXISTS (SELECT 1 FROM "_AreaToTeam" at2 WHERE at2."B" = t."id" AND at2."A" IN (${areaPlaceholders.join(", ")}))`;
  }

  return {
    whereSQL: `${wordConditions.join(" AND ")}${scopeSQL}`,
    params,
  };
}

export async function searchTeamsWithUnaccent(
  search: string,
  page: number = 1,
  pageSize: number = 10,
  scope?: SearchTeamsScope,
): Promise<{ ids: string[]; total: number }> {
  const conditions = buildTeamSearchConditions(search, scope);
  if (!conditions) return { ids: [], total: 0 };

  const { whereSQL, params } = conditions;
  let nextParam = params.length + 1;

  const limitParam = `$${nextParam}`;
  nextParam++;
  params.push(pageSize);

  const offsetParam = `$${nextParam}`;
  params.push((page - 1) * pageSize);

  const rows = await prisma.$queryRawUnsafe<{ id: string; total: bigint }[]>(
    `SELECT t."id", COUNT(*) OVER() AS total
     FROM "Team" t
     WHERE t."deletedAt" IS NULL AND ${whereSQL}
     ORDER BY t."name" ASC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    ...params,
  );

  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  return { ids: rows.map((r) => r.id), total };
}
