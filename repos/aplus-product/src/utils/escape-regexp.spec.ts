import { escapeRegExp } from "./escape-regexp";

describe("escapeRegExp", () => {
  it("laisse intacte une chaîne sans métacaractère", () => {
    expect(escapeRegExp("Dupont")).toBe("Dupont");
  });

  it.each([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"])(
    "échappe le métacaractère %s",
    (char) => {
      expect(escapeRegExp(char)).toBe(`\\${char}`);
    },
  );

  it("produit une RegExp qui matche la chaîne littérale", () => {
    const pattern = new RegExp(escapeRegExp("Dossier n°(2024)"));
    expect(pattern.test("Dossier n°(2024) en cours")).toBe(true);
    expect(pattern.test("Dossier n°2024 en cours")).toBe(false);
  });
});
