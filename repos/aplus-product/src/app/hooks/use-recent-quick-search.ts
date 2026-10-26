import { useState } from "react";
import {
  QUICK_SEARCH_MAX_RECENTS,
  QUICK_SEARCH_RECENTS_KEY,
} from "@/app/constant/quick-search";
import type { QuickSearchItem } from "@/types/quick-search";
import { pushRecent } from "@/utils/quick-search";

// sessionStorage : sur un poste partagé, noms et e-mails ne survivent pas à l'onglet.
function readRecents(): QuickSearchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(QUICK_SEARCH_RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QuickSearchItem[]) : [];
  } catch {
    return [];
  }
}

export function useRecentQuickSearch() {
  const [recents, setRecents] = useState<QuickSearchItem[]>(readRecents);

  function addRecent(item: QuickSearchItem) {
    const next = pushRecent(recents, item, QUICK_SEARCH_MAX_RECENTS);
    setRecents(next);
    try {
      window.sessionStorage.setItem(
        QUICK_SEARCH_RECENTS_KEY,
        JSON.stringify(next),
      );
    } catch {
      // Stockage plein ou désactivé : les récents restent en mémoire.
    }
  }

  return { recents, addRecent };
}
