import {
  canonicalTag,
  sameTag,
  TAG_MAX_LENGTH,
  TAG_MAX_WORDS,
  UNDETERMINED_GOLDEN_TAG,
  validateAnnotationTag,
} from "./golden-dataset-tag";

describe("validateAnnotationTag", () => {
  it.each([
    "compte inactif",
    "bug informatique",
    "retard",
    "perte carte identité",
  ])("accepte « %s »", (tag) => {
    expect(validateAnnotationTag(tag)).toEqual({ ok: true, value: tag });
  });

  it("renvoie null pour null, undefined et la chaîne vide", () => {
    expect(validateAnnotationTag(null)).toEqual({ ok: true, value: null });
    expect(validateAnnotationTag(undefined)).toEqual({ ok: true, value: null });
    expect(validateAnnotationTag("   ")).toEqual({ ok: true, value: null });
  });

  it("trime et normalise les espaces internes", () => {
    expect(validateAnnotationTag("  compte    inactif ")).toEqual({
      ok: true,
      value: "compte inactif",
    });
  });

  it("refuse six mots séparés par des espaces", () => {
    expect(validateAnnotationTag("un deux trois quatre cinq six")).toEqual({
      ok: false,
      error: "Le tag doit rester court : 5 mots au maximum.",
    });
  });

  it("ne compte pas les apostrophes ni les traits d'union comme séparateurs", () => {
    expect(validateAnnotationTag("perte carte d'identité")).toEqual({
      ok: true,
      value: "perte carte d'identité",
    });
    expect(validateAnnotationTag("rendez-vous non honoré")).toEqual({
      ok: true,
      value: "rendez-vous non honoré",
    });
    expect(validateAnnotationTag("perte de carte d'identité")).toEqual({
      ok: true,
      value: "perte de carte d'identité",
    });
  });

  it("accepte une chaîne de 60 caractères et refuse une de 61", () => {
    expect(validateAnnotationTag("a".repeat(TAG_MAX_LENGTH))).toEqual({
      ok: true,
      value: "a".repeat(TAG_MAX_LENGTH),
    });
    expect(validateAnnotationTag("a".repeat(TAG_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: "Le tag ne doit pas dépasser 60 caractères.",
    });
  });

  it("mesure la longueur après trim", () => {
    const raw = `  ${"a".repeat(TAG_MAX_LENGTH)}  `;
    expect(validateAnnotationTag(raw)).toEqual({
      ok: true,
      value: "a".repeat(TAG_MAX_LENGTH),
    });
  });

  it("refuse la longueur avant de refuser le nombre de mots", () => {
    const tooLongAndTooManyWords = `${"a".repeat(30)} ${"b".repeat(30)} c d`;
    expect(validateAnnotationTag(tooLongAndTooManyWords)).toEqual({
      ok: false,
      error: "Le tag ne doit pas dépasser 60 caractères.",
    });
  });

  it("accepte exactement TAG_MAX_WORDS mots", () => {
    const tag = Array.from({ length: TAG_MAX_WORDS }, (_, i) => `m${i}`).join(
      " ",
    );
    expect(validateAnnotationTag(tag)).toEqual({ ok: true, value: tag });
  });
});

describe("canonicalTag", () => {
  it("met en minuscules, retire les accents et réduit les espaces", () => {
    expect(canonicalTag("  Délai   Anormal ")).toBe("delai anormal");
  });

  it("réduit à la chaîne vide un texte qui n'a que des espaces", () => {
    expect(canonicalTag("   ")).toBe("");
    expect(canonicalTag("")).toBe("");
  });
});

describe("sameTag", () => {
  it("ignore la casse", () => {
    expect(sameTag("Retard CPAM", "retard cpam")).toBe(true);
  });

  it("ignore les accents", () => {
    expect(sameTag("délai anormal", "delai anormal")).toBe(true);
  });

  it("ignore les espaces internes multiples", () => {
    expect(sameTag("dossier    bloqué", "dossier bloqué")).toBe(true);
  });

  it("ignore les espaces de bord", () => {
    expect(sameTag("  carte vitale  ", "carte vitale")).toBe(true);
  });

  it("est vrai pour un tag comparé à lui-même", () => {
    expect(sameTag("pièce manquante", "pièce manquante")).toBe(true);
  });

  it("est faux pour deux textes réellement différents", () => {
    expect(sameTag("dossier bloqué", "pièce manquante")).toBe(false);
  });

  it.each([null, undefined, "", "   "])(
    "n'égale rien quand un côté vaut %p",
    (empty) => {
      expect(sameTag(empty, "dossier bloqué")).toBe(false);
      expect(sameTag("dossier bloqué", empty)).toBe(false);
    },
  );

  it("n'égale pas deux absences entre elles", () => {
    expect(sameTag(null, null)).toBe(false);
    expect(sameTag(undefined, undefined)).toBe(false);
    expect(sameTag("", "")).toBe(false);
    expect(sameTag("   ", " ")).toBe(false);
  });
});

describe("UNDETERMINED_GOLDEN_TAG", () => {
  it("traverse la validation sans être modifié, donc la mutation peut l'écrire", () => {
    expect(validateAnnotationTag(UNDETERMINED_GOLDEN_TAG)).toEqual({
      ok: true,
      value: UNDETERMINED_GOLDEN_TAG,
    });
  });
});
