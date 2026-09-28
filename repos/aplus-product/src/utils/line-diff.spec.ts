import { diffLines } from "./line-diff";

describe("diffLines", () => {
  it("ne signale rien entre deux textes identiques", () => {
    expect(diffLines("a\nb", "a\nb").every((l) => l.kind === "same")).toBe(
      true,
    );
  });

  it("repère une ligne insérée au milieu", () => {
    expect(diffLines("a\nc", "a\nb\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "added", text: "b" },
      { kind: "same", text: "c" },
    ]);
  });

  it("repère une ligne remplacée", () => {
    expect(diffLines("a\nb\nc", "a\nB\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "B" },
      { kind: "same", text: "c" },
    ]);
  });

  it("reconstruit les deux textes", () => {
    const before = "x\ny\nz\nw";
    const after = "y\nq\nw\nv";
    const lines = diffLines(before, after);

    expect(
      lines
        .filter((l) => l.kind !== "added")
        .map((l) => l.text)
        .join("\n"),
    ).toBe(before);
    expect(
      lines
        .filter((l) => l.kind !== "removed")
        .map((l) => l.text)
        .join("\n"),
    ).toBe(after);
  });
});
