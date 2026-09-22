import { normalizeEmail, normalizeSearchQuery } from "./normalize";

describe("normalizeEmail", () => {
  it("met l'adresse en minuscules", () => {
    expect(normalizeEmail("John.Doe@Example.COM")).toBe("john.doe@example.com");
  });

  it("supprime les espaces en début et fin", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("combine trim et minuscules", () => {
    expect(normalizeEmail("  Jean.Martin@Gouv.FR ")).toBe(
      "jean.martin@gouv.fr",
    );
  });

  it("préserve les accents (un accent fait partie de l'adresse)", () => {
    expect(normalizeEmail("Préé@exémple.fr")).toBe("préé@exémple.fr");
  });

  it("est idempotent", () => {
    const once = normalizeEmail("  User@Example.com ");
    expect(normalizeEmail(once)).toBe(once);
  });

  it("rend identiques deux variantes de casse/espaces du même email", () => {
    expect(normalizeEmail(" USER@Example.com")).toBe(
      normalizeEmail("user@example.com "),
    );
  });
});

describe("normalizeSearchQuery", () => {
  it("retire les accents (contrairement à normalizeEmail)", () => {
    expect(normalizeSearchQuery("Préé")).toBe("pree");
  });
});
