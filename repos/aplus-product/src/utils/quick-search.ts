import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import { ROUTE } from "@/app/constant/route";
import { QUICK_SEARCH_KINDS, type QuickSearchItem } from "@/types/quick-search";
import { formatDate } from "./format";
import { normalizeSearchQuery } from "./normalize";

type QuickSearchResult = inferRouterOutputs<AppRouter>["quickSearch"]["search"];

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Extrait un identifiant collé tel quel ou au milieu d'une URL
 * (ex. `https://…/signalement/<uuid>`), pour ouvrir directement l'entité.
 */
export function extractUuid(query: string): string | null {
  const match = query.match(UUID_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

export function toQuickSearchItems(result: QuickSearchResult): {
  reports: QuickSearchItem[];
  users: QuickSearchItem[];
  teams: QuickSearchItem[];
} {
  return {
    reports: result.reports.map((report) => ({
      kind: QUICK_SEARCH_KINDS.REPORT,
      id: report.id,
      label: report.subject,
      detail: `${report.author.firstName} ${report.author.lastName} · ${formatDate(report.createdAt, "Europe/Paris")}`,
      href: `${ROUTE.REPORT}/${report.id}`,
      status: report.status,
    })),
    users: result.users.map((user) => ({
      kind: QUICK_SEARCH_KINDS.USER,
      id: user.id,
      label: `${user.firstName} ${user.lastName}`,
      detail: user.email,
      href: `${ROUTE.EDIT_USER}/${user.id}`,
    })),
    teams: result.teams.map((team) => ({
      kind: QUICK_SEARCH_KINDS.TEAM,
      id: team.id,
      label: team.name,
      detail: team.organization.shortName,
      href: `${ROUTE.TEAMS}/${team.id}`,
    })),
  };
}

export function filterQuickSearchPages(
  pages: QuickSearchItem[],
  query: string,
): QuickSearchItem[] {
  const words = normalizeSearchQuery(query).split(/\s+/).filter(Boolean);
  return pages.filter((page) => {
    const label = normalizeSearchQuery(page.label);
    return words.every((word) => label.includes(word));
  });
}

/** Le plus récent en tête, sans doublon, borné à `max`. */
export function pushRecent(
  recents: QuickSearchItem[],
  item: QuickSearchItem,
  max: number,
): QuickSearchItem[] {
  const rest = recents.filter(
    (recent) => !(recent.kind === item.kind && recent.id === item.id),
  );
  return [item, ...rest].slice(0, max);
}
