import { nextCursor, olderThan } from "./keyset-pagination";

describe("keyset-pagination", () => {
  it("ne filtre rien sur la première page", () => {
    expect(olderThan(null)).toEqual({});
  });

  it("reprend strictement après la dernière ligne, départagée par l'id", () => {
    const createdAt = new Date("2026-09-01T00:00:00Z");
    expect(olderThan({ createdAt, id: "b" })).toEqual({
      OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: "b" } }],
    });
  });

  it("prend la dernière ligne de la page comme curseur", () => {
    const first = { createdAt: new Date(2), id: "b", extra: 1 };
    const last = { createdAt: new Date(1), id: "a", extra: 2 };
    expect(nextCursor([first, last])).toEqual({
      createdAt: last.createdAt,
      id: "a",
    });
  });
});
