import type { StatsFilters } from "@/trpc/routers/stats";
import { isValidIsoDate } from "@/utils/iso-date";
import { MAX_ID_LENGTH, MAX_SELECTED_IDS } from "@/utils/stats-filters-limits";

/**
 * (Dé)sérialisation des filtres de la page Statistiques vers/depuis l'URL, pour
 * permettre le partage de pages filtrées.
 *
 * Format : un paramètre par filtre. Les tableaux d'ids sont joints par des
 * virgules (les ids n'en contiennent pas) → URL compacte et lisible.
 *   ?startDate=2024-01-01&areaIds=area-1,area-2&requestedTeamIds=team-9
 */

const ARRAY_KEYS = [
  "areaIds",
  "authorOrganizationIds",
  "authorTeamIds",
  "requestedOrganizationIds",
  "requestedTeamIds",
] as const;

/**
 * Lit les filtres depuis des `URLSearchParams` (client ou serveur).
 *
 * L'URL est modifiable à la main : ce qui ne peut pas être un filtre valide y
 * est ignoré plutôt que transmis tel quel — une date mal formée, un id
 * démesuré, une liste à rallonge. Le routeur les rejetterait (validation Zod)
 * et la page afficherait une erreur de chargement, là où les écarter dégrade
 * proprement vers des statistiques non filtrées sur la dimension concernée.
 */
export function parseStatsFiltersFromParams(
  params: URLSearchParams,
): StatsFilters {
  const filters: StatsFilters = {};

  const startDate = params.get("startDate");
  if (startDate && isValidIsoDate(startDate)) filters.startDate = startDate;

  const endDate = params.get("endDate");
  if (endDate && isValidIsoDate(endDate)) filters.endDate = endDate;

  for (const key of ARRAY_KEYS) {
    const raw = params.get(key);
    if (!raw) continue;
    const ids = raw
      .split(",")
      .filter((id) => id.length > 0 && id.length <= MAX_ID_LENGTH)
      .slice(0, MAX_SELECTED_IDS);
    if (ids.length > 0) filters[key] = ids;
  }

  return filters;
}

/**
 * Variante pour le `searchParams` d'un Server Component (objet déjà résolu).
 * Une valeur tableau (param répété) est aplatie en chaîne séparée par des
 * virgules avant analyse.
 */
export function parseStatsFiltersFromRecord(
  record: Record<string, string | string[] | undefined>,
): StatsFilters {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) params.set(key, value.join(","));
  }
  return parseStatsFiltersFromParams(params);
}

/** Sérialise les filtres en `URLSearchParams` (vide si aucun filtre actif). */
export function statsFiltersToSearchParams(
  filters: StatsFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  for (const key of ARRAY_KEYS) {
    const ids = filters[key];
    if (ids && ids.length > 0) params.set(key, ids.join(","));
  }

  return params;
}
