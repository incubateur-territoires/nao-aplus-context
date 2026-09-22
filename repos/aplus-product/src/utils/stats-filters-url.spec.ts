import { MAX_ID_LENGTH, MAX_SELECTED_IDS } from "./stats-filters-limits";
import {
  parseStatsFiltersFromParams,
  parseStatsFiltersFromRecord,
  statsFiltersToSearchParams,
} from "./stats-filters-url";

describe("stats-filters-url", () => {
  it("parse les dates et tableaux depuis URLSearchParams", () => {
    const params = new URLSearchParams(
      "startDate=2024-01-01&endDate=2024-12-31&areaIds=area-1,area-2&requestedTeamIds=team-9",
    );
    expect(parseStatsFiltersFromParams(params)).toEqual({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      areaIds: ["area-1", "area-2"],
      requestedTeamIds: ["team-9"],
    });
  });

  it("ignore les paramètres vides", () => {
    const params = new URLSearchParams("areaIds=&startDate=");
    expect(parseStatsFiltersFromParams(params)).toEqual({});
  });

  it("écarte une date forgée plutôt que de la transmettre au routeur", () => {
    const params = new URLSearchParams(
      "startDate=pas-une-date&endDate=2024-02-31",
    );
    expect(parseStatsFiltersFromParams(params)).toEqual({});
  });

  it("écarte les ids trop longs et plafonne les listes à rallonge", () => {
    const params = new URLSearchParams();
    params.set("areaIds", `area-1,${"x".repeat(MAX_ID_LENGTH + 1)}`);
    params.set(
      "authorTeamIds",
      Array.from({ length: MAX_SELECTED_IDS + 10 }, (_, i) => `team-${i}`).join(
        ",",
      ),
    );

    const filters = parseStatsFiltersFromParams(params);
    expect(filters.areaIds).toEqual(["area-1"]);
    expect(filters.authorTeamIds).toHaveLength(MAX_SELECTED_IDS);
  });

  it("aplatit les paramètres répétés depuis un Record serveur", () => {
    expect(
      parseStatsFiltersFromRecord({
        areaIds: ["area-1", "area-2"],
        startDate: "2024-01-01",
        unknown: undefined,
      }),
    ).toEqual({
      areaIds: ["area-1", "area-2"],
      startDate: "2024-01-01",
    });
  });

  it("sérialise les filtres (et omet les valeurs vides)", () => {
    const params = statsFiltersToSearchParams({
      startDate: "2024-01-01",
      areaIds: ["area-1", "area-2"],
      authorTeamIds: [],
    });
    expect(params.get("startDate")).toBe("2024-01-01");
    expect(params.get("areaIds")).toBe("area-1,area-2");
    expect(params.has("authorTeamIds")).toBe(false);
    expect(params.has("endDate")).toBe(false);
  });

  it("fait un aller-retour identique", () => {
    const filters = {
      startDate: "2024-01-01",
      areaIds: ["area-1"],
      requestedOrganizationIds: ["org-2", "org-3"],
    };
    const params = statsFiltersToSearchParams(filters);
    expect(parseStatsFiltersFromParams(params)).toEqual(filters);
  });
});
