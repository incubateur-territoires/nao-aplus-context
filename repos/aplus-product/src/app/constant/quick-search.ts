import { ROUTE } from "./route";
import { QUICK_SEARCH_KINDS, type QuickSearchItem } from "@/types/quick-search";

function page(label: string, href: string): QuickSearchItem {
  return { kind: QUICK_SEARCH_KINDS.PAGE, id: href, label, href };
}

export const QUICK_SEARCH_PAGES: QuickSearchItem[] = [
  page("Tous les signalements", ROUTE.ALL_REPORTS),
  page("Équipes", ROUTE.TEAMS),
  page("Créer une équipe", ROUTE.CREATE_TEAM),
  page("Utilisateurs", ROUTE.USERS),
  page("Créer un superviseur", ROUTE.CREATE_SUPERVISOR),
  page("Statistiques", ROUTE.STATISTIQUES),
  page("Bandeau", ROUTE.ADMIN_BANNER),
  page("Signalements anonymisés", ROUTE.ANONYMIZED_REPORTS),
  page("Étiquetage IA", ROUTE.ADMIN_TAGGING),
  page("CRM", ROUTE.CONTACTS),
  page("Golden dataset", ROUTE.GOLDEN_DATASET),
  page("Mon profil", ROUTE.PROFILE),
];

export const QUICK_SEARCH_RECENTS_KEY = "aplus:quick-search:recents";
export const QUICK_SEARCH_MAX_RECENTS = 5;
