import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { SortingState } from "@tanstack/react-table";
import { useDebounce } from "@/app/hooks/use-debounce";

interface SortConfig {
  id: string;
  desc: boolean;
}

interface UseUrlTableStateOptions {
  /**
   * Préfixe appliqué à toutes les clés (ex. "t_", "u_") afin d'isoler l'état de
   * ce tableau et de permettre un reset ciblé.
   */
  prefix: string;
  /** Tri par défaut, appliqué quand l'URL ne contient pas de tri valide. */
  defaultSort: SortConfig;
  /** Clés de tri autorisées ; un tri inconnu retombe sur `defaultSort`. */
  validSortKeys: readonly string[];
  /** Délai de debounce de la recherche avant écriture dans l'URL (ms). */
  searchDebounceMs?: number;
  /**
   * Clés (sans préfixe) de pagination secondaires à réinitialiser en même temps
   * que `page` lorsqu'un filtre change (ex. la page de l'onglet « en attente »).
   */
  resetPageParams?: readonly string[];
}

interface UpdateParamsOptions {
  resetPage?: boolean;
}

interface UseUrlTableStateReturn {
  // Recherche : input local (frappe fluide) + valeur debouncée écrite dans l'URL.
  searchInput: string;
  setSearchInput: (value: string) => void;
  debouncedSearch: string;
  // Pagination principale.
  page: number;
  setPage: (page: number) => void;
  // Tri.
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  // Filtres tableau (valeurs multiples) et pagination secondaire.
  getArrayParam: (name: string) => string[];
  setArrayParam: (name: string, values: string[]) => void;
  getNumberParam: (name: string, fallback: number) => number;
  setNumberParam: (name: string, value: number, fallback: number) => void;
  getStringParam: (name: string, fallback: string) => string;
  setStringParam: (name: string, value: string, fallback: string) => void;
  // Primitives bas niveau.
  updateParams: (
    updates: Record<string, string | null>,
    opts?: UpdateParamsOptions,
  ) => void;
  resetFilters: () => void;
}

/**
 * Mémorise l'état d'un tableau (recherche, pagination, tri, filtres) dans les
 * query params de l'URL plutôt que dans du state local.
 *
 * L'URL devient la source de vérité : l'état survit à la navigation (consulter
 * une fiche puis revenir, bouton « précédent » du navigateur) et reste
 * partageable. Le même mécanisme alimente la liste des signalements
 * (cf. `use-paginated-reports`) ; ce hook le généralise aux autres tableaux.
 */
export function useUrlTableState({
  prefix,
  defaultSort,
  validSortKeys,
  searchDebounceMs = 300,
  resetPageParams,
}: UseUrlTableStateOptions): UseUrlTableStateReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { id: defaultSortId, desc: defaultSortDesc } = defaultSort;
  const validSortKey = validSortKeys.join(",");
  const validSortSet = useMemo(
    () => new Set(validSortKey ? validSortKey.split(",") : []),
    [validSortKey],
  );
  const resetPageKey = resetPageParams?.join(",") ?? "";

  // Met à jour les query params de ce tableau en préservant ceux des autres.
  const updateParams = useCallback(
    (updates: Record<string, string | null>, opts?: UpdateParamsOptions) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [name, value] of Object.entries(updates)) {
        const fullKey = `${prefix}${name}`;
        if (value === null || value === "") params.delete(fullKey);
        else params.set(fullKey, value);
      }
      if (opts?.resetPage) {
        params.delete(`${prefix}page`);
        for (const extra of resetPageKey ? resetPageKey.split(",") : []) {
          params.delete(`${prefix}${extra}`);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, prefix, pathname, router, resetPageKey],
  );

  // --- Valeurs dérivées de l'URL (source de vérité) ---

  const page = useMemo(() => {
    const raw = Number(searchParams.get(`${prefix}page`));
    return Number.isInteger(raw) && raw > 0 ? raw : 1;
  }, [searchParams, prefix]);

  const sorting = useMemo<SortingState>(() => {
    const sortBy = searchParams.get(`${prefix}sort`);
    if (sortBy && validSortSet.has(sortBy)) {
      return [
        { id: sortBy, desc: searchParams.get(`${prefix}order`) !== "asc" },
      ];
    }
    return [{ id: defaultSortId, desc: defaultSortDesc }];
  }, [searchParams, prefix, validSortSet, defaultSortId, defaultSortDesc]);

  // --- Recherche : input local + écriture debouncée dans l'URL ---

  const urlSearch = searchParams.get(`${prefix}q`) ?? "";
  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchInput, searchDebounceMs);
  // Dernière recherche écrite dans l'URL dont l'écho (mise à jour asynchrone de
  // useSearchParams après router.replace) n'est pas encore revenu.
  const pendingSearchWrite = useRef<string | null>(null);

  // Écrit la recherche debouncée dans l'URL.
  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      pendingSearchWrite.current = debouncedSearch;
      updateParams({ q: debouncedSearch || null }, { resetPage: true });
    }
    // urlSearch/updateParams volontairement omis : déclenché par la frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Resynchronise l'input quand l'URL change de l'extérieur (retour navigateur).
  // Les échos de nos propres écritures sont ignorés : la navigation de
  // router.replace est asynchrone et l'utilisateur a pu taper entre-temps ;
  // resynchroniser depuis un écho écraserait ces caractères.
  useEffect(() => {
    if (pendingSearchWrite.current !== null) {
      if (urlSearch !== pendingSearchWrite.current) return; // écho intermédiaire
      pendingSearchWrite.current = null;
      // La saisie a pu revenir à l'ancienne valeur pendant le vol de l'écho
      // sans déclencher d'écriture : reconverger l'URL vers la saisie.
      if (debouncedSearch !== urlSearch) {
        pendingSearchWrite.current = debouncedSearch;
        updateParams({ q: debouncedSearch || null }, { resetPage: true });
      }
      return;
    }
    setSearchInput(urlSearch);
    // debouncedSearch/updateParams volontairement omis : déclenché par l'URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  // --- Setters (écrivent dans l'URL) ---

  const setPage = useCallback(
    (newPage: number) => {
      updateParams({ page: newPage > 1 ? String(newPage) : null });
    },
    [updateParams],
  );

  const setSorting = useCallback(
    (newSorting: SortingState) => {
      const next = newSorting[0];
      const isDefault =
        !next || (next.id === defaultSortId && next.desc === defaultSortDesc);
      updateParams(
        {
          sort: isDefault ? null : next.id,
          order: isDefault ? null : next.desc ? "desc" : "asc",
        },
        { resetPage: true },
      );
    },
    [updateParams, defaultSortId, defaultSortDesc],
  );

  const getArrayParam = useCallback(
    (name: string) => {
      const raw = searchParams.get(`${prefix}${name}`);
      return raw ? raw.split(",").filter(Boolean) : [];
    },
    [searchParams, prefix],
  );

  const setArrayParam = useCallback(
    (name: string, values: string[]) => {
      updateParams(
        { [name]: values.length ? values.join(",") : null },
        { resetPage: true },
      );
    },
    [updateParams],
  );

  const getNumberParam = useCallback(
    (name: string, fallback: number) => {
      const raw = Number(searchParams.get(`${prefix}${name}`));
      return Number.isInteger(raw) && raw > 0 ? raw : fallback;
    },
    [searchParams, prefix],
  );

  const setNumberParam = useCallback(
    (name: string, value: number, fallback: number) => {
      updateParams({ [name]: value !== fallback ? String(value) : null });
    },
    [updateParams],
  );

  const getStringParam = useCallback(
    (name: string, fallback: string) =>
      searchParams.get(`${prefix}${name}`) ?? fallback,
    [searchParams, prefix],
  );

  const setStringParam = useCallback(
    (name: string, value: string, fallback: string) => {
      updateParams({ [name]: value !== fallback ? value : null });
    },
    [updateParams],
  );

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of Array.from(params.keys())) {
      if (k.startsWith(prefix)) params.delete(k);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setSearchInput("");
  }, [searchParams, prefix, pathname, router]);

  return {
    searchInput,
    setSearchInput,
    debouncedSearch,
    page,
    setPage,
    sorting,
    setSorting,
    getArrayParam,
    setArrayParam,
    getNumberParam,
    setNumberParam,
    getStringParam,
    setStringParam,
    updateParams,
    resetFilters,
  };
}
