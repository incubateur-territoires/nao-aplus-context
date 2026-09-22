import { renderHook, act } from "@testing-library/react";
import { useUrlTableState } from "./use-url-table-state";

// Mock contrôlable de next/navigation : `mockNav.params` est la source de
// vérité lue par le hook, `mockReplace` capture les écritures dans l'URL.
const mockReplace = jest.fn();
const mockNav = {
  params: new URLSearchParams(),
  pathname: "/equipes",
};

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockNav.params,
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockNav.pathname,
}));

const TEAMS_OPTIONS = {
  prefix: "t_",
  defaultSort: { id: "name", desc: false },
  validSortKeys: ["name", "territoire", "organisation", "registrationNumber"],
};

const USERS_OPTIONS = {
  prefix: "u_",
  defaultSort: { id: "member", desc: false },
  validSortKeys: ["member", "role"],
  resetPageParams: ["pending_page"],
};

// Reconstruit les query params de la dernière redirection émise.
function lastReplacedParams(): URLSearchParams {
  const calls = mockReplace.mock.calls;
  const url = calls[calls.length - 1]?.[0] as string | undefined;
  if (!url) return new URLSearchParams();
  const qs = url.includes("?") ? url.split("?")[1] : "";
  return new URLSearchParams(qs);
}

describe("useUrlTableState", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReplace.mockClear();
    mockNav.params = new URLSearchParams();
    mockNav.pathname = "/equipes";
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("valeurs par défaut (URL vide)", () => {
    it("retourne les valeurs initiales", () => {
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      expect(result.current.page).toBe(1);
      expect(result.current.sorting).toEqual([{ id: "name", desc: false }]);
      expect(result.current.searchInput).toBe("");
      expect(result.current.getArrayParam("areas")).toEqual([]);
      expect(result.current.getNumberParam("pending_page", 1)).toBe(1);
    });
  });

  describe("restauration depuis l'URL", () => {
    it("lit la page, le tri, les filtres et la recherche", () => {
      mockNav.params = new URLSearchParams(
        "t_page=3&t_sort=organisation&t_order=asc&t_areas=a1,a2&t_orgs=o1&t_q=hello",
      );

      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      expect(result.current.page).toBe(3);
      // order=asc => desc:false
      expect(result.current.sorting).toEqual([
        { id: "organisation", desc: false },
      ]);
      expect(result.current.getArrayParam("areas")).toEqual(["a1", "a2"]);
      expect(result.current.getArrayParam("orgs")).toEqual(["o1"]);
      expect(result.current.searchInput).toBe("hello");
    });

    it("considère un tri sans `order` comme descendant", () => {
      mockNav.params = new URLSearchParams("t_sort=name");

      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      expect(result.current.sorting).toEqual([{ id: "name", desc: true }]);
    });

    it("retombe sur le tri par défaut si la clé de tri est inconnue", () => {
      mockNav.params = new URLSearchParams("t_sort=inconnu&t_order=asc");

      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      expect(result.current.sorting).toEqual([{ id: "name", desc: false }]);
    });

    it("ignore une page non valide", () => {
      mockNav.params = new URLSearchParams("t_page=0");

      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      expect(result.current.page).toBe(1);
    });

    it("lit une pagination secondaire via getNumberParam", () => {
      mockNav.params = new URLSearchParams("u_pending_page=4");

      const { result } = renderHook(() => useUrlTableState(USERS_OPTIONS));

      expect(result.current.getNumberParam("pending_page", 1)).toBe(4);
    });
  });

  describe("setPage", () => {
    it("écrit la page dans l'URL", () => {
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setPage(2));

      expect(lastReplacedParams().get("t_page")).toBe("2");
    });

    it("supprime le param pour la page 1", () => {
      mockNav.params = new URLSearchParams("t_page=5");
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setPage(1));

      expect(lastReplacedParams().get("t_page")).toBeNull();
    });

    it("appelle router.replace avec scroll:false", () => {
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setPage(2));

      expect(mockReplace).toHaveBeenLastCalledWith(expect.any(String), {
        scroll: false,
      });
    });
  });

  describe("setArrayParam", () => {
    it("sérialise les valeurs et réinitialise la page", () => {
      mockNav.params = new URLSearchParams("t_page=5");
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setArrayParam("areas", ["a1", "a2"]));

      const params = lastReplacedParams();
      expect(params.get("t_areas")).toBe("a1,a2");
      expect(params.get("t_page")).toBeNull();
    });

    it("supprime le param quand la liste est vide", () => {
      mockNav.params = new URLSearchParams("t_areas=a1");
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setArrayParam("areas", []));

      expect(lastReplacedParams().get("t_areas")).toBeNull();
    });
  });

  describe("setSorting", () => {
    it("écrit le tri et son sens, et réinitialise la page", () => {
      mockNav.params = new URLSearchParams("t_page=4");
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() =>
        result.current.setSorting([{ id: "organisation", desc: false }]),
      );

      const params = lastReplacedParams();
      expect(params.get("t_sort")).toBe("organisation");
      expect(params.get("t_order")).toBe("asc");
      expect(params.get("t_page")).toBeNull();
    });

    it("écrit order=desc pour un tri descendant", () => {
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() =>
        result.current.setSorting([{ id: "organisation", desc: true }]),
      );

      const params = lastReplacedParams();
      expect(params.get("t_sort")).toBe("organisation");
      expect(params.get("t_order")).toBe("desc");
    });

    it("supprime les params quand on revient au tri par défaut", () => {
      mockNav.params = new URLSearchParams("t_sort=organisation&t_order=asc");
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setSorting([{ id: "name", desc: false }]));

      const params = lastReplacedParams();
      expect(params.get("t_sort")).toBeNull();
      expect(params.get("t_order")).toBeNull();
    });

    it("traite un tri vide comme le tri par défaut", () => {
      mockNav.params = new URLSearchParams("t_sort=organisation&t_order=asc");
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setSorting([]));

      const params = lastReplacedParams();
      expect(params.get("t_sort")).toBeNull();
      expect(params.get("t_order")).toBeNull();
    });
  });

  describe("setNumberParam / pagination secondaire", () => {
    it("écrit la valeur sans réinitialiser la page principale", () => {
      mockNav.params = new URLSearchParams("u_page=2");
      const { result } = renderHook(() => useUrlTableState(USERS_OPTIONS));

      act(() => result.current.setNumberParam("pending_page", 3, 1));

      const params = lastReplacedParams();
      expect(params.get("u_pending_page")).toBe("3");
      expect(params.get("u_page")).toBe("2");
    });

    it("supprime le param quand la valeur revient à la valeur par défaut", () => {
      mockNav.params = new URLSearchParams("u_pending_page=3");
      const { result } = renderHook(() => useUrlTableState(USERS_OPTIONS));

      act(() => result.current.setNumberParam("pending_page", 1, 1));

      expect(lastReplacedParams().get("u_pending_page")).toBeNull();
    });
  });

  describe("getStringParam / setStringParam", () => {
    it("lit la valeur depuis l'URL", () => {
      mockNav.params = new URLSearchParams("u_tab=attente");
      const { result } = renderHook(() => useUrlTableState(USERS_OPTIONS));

      expect(result.current.getStringParam("tab", "actifs")).toBe("attente");
    });

    it("retombe sur la valeur par défaut quand le param est absent", () => {
      const { result } = renderHook(() => useUrlTableState(USERS_OPTIONS));

      expect(result.current.getStringParam("tab", "actifs")).toBe("actifs");
    });

    it("écrit la valeur sans réinitialiser la page principale", () => {
      mockNav.params = new URLSearchParams("u_page=2");
      const { result } = renderHook(() => useUrlTableState(USERS_OPTIONS));

      act(() => result.current.setStringParam("tab", "attente", "actifs"));

      const params = lastReplacedParams();
      expect(params.get("u_tab")).toBe("attente");
      expect(params.get("u_page")).toBe("2");
    });

    it("supprime le param quand la valeur revient à la valeur par défaut", () => {
      mockNav.params = new URLSearchParams("u_tab=attente");
      const { result } = renderHook(() => useUrlTableState(USERS_OPTIONS));

      act(() => result.current.setStringParam("tab", "actifs", "actifs"));

      expect(lastReplacedParams().get("u_tab")).toBeNull();
    });
  });

  describe("resetPageParams", () => {
    it("réinitialise aussi les paginations secondaires au changement de filtre", () => {
      mockNav.params = new URLSearchParams("u_page=2&u_pending_page=3");
      const { result } = renderHook(() => useUrlTableState(USERS_OPTIONS));

      act(() => result.current.setSorting([{ id: "role", desc: true }]));

      const params = lastReplacedParams();
      expect(params.get("u_sort")).toBe("role");
      expect(params.get("u_page")).toBeNull();
      expect(params.get("u_pending_page")).toBeNull();
    });
  });

  describe("recherche debouncée", () => {
    it("n'écrit pas avant l'expiration du debounce", () => {
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setSearchInput("paris"));

      expect(result.current.searchInput).toBe("paris");
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("écrit la recherche dans l'URL après le debounce et réinitialise la page", () => {
      mockNav.params = new URLSearchParams("t_page=4");
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setSearchInput("paris"));
      act(() => {
        jest.advanceTimersByTime(300);
      });

      const params = lastReplacedParams();
      expect(params.get("t_q")).toBe("paris");
      expect(params.get("t_page")).toBeNull();
    });

    it("supprime le param de recherche quand l'input est vidé", () => {
      mockNav.params = new URLSearchParams("t_q=paris");
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setSearchInput(""));
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(lastReplacedParams().get("t_q")).toBeNull();
    });

    it("respecte un délai de debounce personnalisé", () => {
      const { result } = renderHook(() =>
        useUrlTableState({ ...TEAMS_OPTIONS, searchDebounceMs: 1000 }),
      );

      act(() => result.current.setSearchInput("paris"));
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(mockReplace).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(700);
      });
      expect(lastReplacedParams().get("t_q")).toBe("paris");
    });
  });

  describe("resynchronisation depuis l'URL", () => {
    it("resynchronise l'input quand l'URL change de l'extérieur (retour navigateur)", () => {
      mockNav.params = new URLSearchParams("t_q=paris");
      const { result, rerender } = renderHook(() =>
        useUrlTableState(TEAMS_OPTIONS),
      );
      expect(result.current.searchInput).toBe("paris");

      mockNav.params = new URLSearchParams();
      rerender();

      expect(result.current.searchInput).toBe("");
    });

    it("ne perd pas les caractères tapés pendant que l'écriture URL est en vol", () => {
      const { result, rerender } = renderHook(() =>
        useUrlTableState(TEAMS_OPTIONS),
      );

      // Frappe « par », le debounce expire : écriture de t_q=par dans l'URL.
      act(() => result.current.setSearchInput("par"));
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(lastReplacedParams().get("t_q")).toBe("par");

      // L'utilisateur continue de taper pendant la navigation asynchrone.
      act(() => result.current.setSearchInput("paris"));

      // L'écho de l'écriture « par » arrive : il ne doit pas écraser la saisie.
      mockNav.params = new URLSearchParams("t_q=par");
      rerender();

      expect(result.current.searchInput).toBe("paris");

      // Et la valeur complète finit par être écrite dans l'URL.
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(lastReplacedParams().get("t_q")).toBe("paris");
    });

    it("reconverge l'URL quand la saisie est revenue en arrière pendant le vol de l'écho", () => {
      const { result, rerender } = renderHook(() =>
        useUrlTableState(TEAMS_OPTIONS),
      );

      // Frappe « p » écrite dans l'URL, puis effacée avant l'arrivée de l'écho.
      act(() => result.current.setSearchInput("p"));
      act(() => {
        jest.advanceTimersByTime(300);
      });
      act(() => result.current.setSearchInput(""));
      act(() => {
        jest.advanceTimersByTime(300);
      });

      mockNav.params = new URLSearchParams("t_q=p");
      rerender();

      expect(result.current.searchInput).toBe("");
      expect(lastReplacedParams().get("t_q")).toBeNull();
    });
  });

  describe("isolation par préfixe", () => {
    it("préserve les params des autres tableaux lors d'une écriture", () => {
      mockNav.params = new URLSearchParams("r_page=7");
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.setPage(3));

      const params = lastReplacedParams();
      expect(params.get("t_page")).toBe("3");
      expect(params.get("r_page")).toBe("7");
    });
  });

  describe("resetFilters", () => {
    it("supprime uniquement les params du préfixe et vide la recherche", () => {
      mockNav.params = new URLSearchParams(
        "t_page=2&t_q=x&t_areas=a1&other=keep&r_page=9",
      );
      const { result } = renderHook(() => useUrlTableState(TEAMS_OPTIONS));

      act(() => result.current.resetFilters());

      const params = lastReplacedParams();
      expect(params.get("t_page")).toBeNull();
      expect(params.get("t_q")).toBeNull();
      expect(params.get("t_areas")).toBeNull();
      expect(params.get("other")).toBe("keep");
      expect(params.get("r_page")).toBe("9");
      expect(result.current.searchInput).toBe("");
    });
  });
});
