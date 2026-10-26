import {
  extractUuid,
  filterQuickSearchPages,
  pushRecent,
  toQuickSearchItems,
} from "./quick-search";

const ID = "3f2b8c1e-9a4d-4e2f-8b7a-1c5d6e7f8a9b";

describe("extractUuid", () => {
  it("returns a pasted identifier", () => {
    expect(extractUuid(`  ${ID} `)).toBe(ID);
  });

  it("extracts the identifier from a report URL", () => {
    expect(extractUuid(`https://example.org/signalement/${ID}?tab=1`)).toBe(ID);
  });

  it("lowercases the identifier", () => {
    expect(extractUuid(ID.toUpperCase())).toBe(ID);
  });

  it("returns null for plain text", () => {
    expect(extractUuid("dupont caf")).toBeNull();
  });
});

describe("toQuickSearchItems", () => {
  it("maps each entity to its page", () => {
    const items = toQuickSearchItems({
      reports: [
        {
          id: ID,
          subject: "Blocage APL",
          status: "IN_TREATMENT",
          createdAt: new Date("2026-10-01T10:00:00Z"),
          author: { firstName: "Alice", lastName: "Martin" },
        },
      ],
      users: [
        {
          id: "user-42",
          firstName: "Alice",
          lastName: "Martin",
          email: "alice@example.org",
          role: "user",
        },
      ],
      teams: [
        {
          id: "team-7",
          name: "France Services Alpha",
          organization: { shortName: "FS" },
        },
      ],
    });

    expect(items).toEqual({
      reports: [
        {
          kind: "report",
          id: ID,
          label: "Blocage APL",
          detail: "Alice Martin · 01/10/2026",
          href: `/signalement/${ID}`,
          status: "IN_TREATMENT",
        },
      ],
      users: [
        {
          kind: "user",
          id: "user-42",
          label: "Alice Martin",
          detail: "alice@example.org",
          href: "/utilisateurs/modifier/user-42",
        },
      ],
      teams: [
        {
          kind: "team",
          id: "team-7",
          label: "France Services Alpha",
          detail: "FS",
          href: "/equipes/team-7",
        },
      ],
    });
  });
});

describe("filterQuickSearchPages", () => {
  const pages = [
    { kind: "page" as const, id: "a", label: "Étiquetage IA", href: "/a" },
    { kind: "page" as const, id: "b", label: "Créer une équipe", href: "/b" },
  ];

  it("matches every word regardless of accents and case", () => {
    expect(filterQuickSearchPages(pages, "creer EQUIPE")).toEqual([pages[1]]);
    expect(filterQuickSearchPages(pages, "etiquetage")).toEqual([pages[0]]);
  });

  it("returns nothing when a word does not match", () => {
    expect(filterQuickSearchPages(pages, "équipe bandeau")).toEqual([]);
  });
});

describe("pushRecent", () => {
  function item(id: string) {
    return { kind: "user" as const, id, label: id, href: `/u/${id}` };
  }

  it("puts the item first, removes its previous entry and caps the list", () => {
    const recents = [item("a"), item("b"), item("c")];
    expect(pushRecent(recents, item("b"), 3).map((r) => r.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(pushRecent(recents, item("d"), 3).map((r) => r.id)).toEqual([
      "d",
      "a",
      "b",
    ]);
  });
});
