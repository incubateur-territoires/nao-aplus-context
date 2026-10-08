import {
  organizationLabel,
  reportTaggingRecipeKey,
  storedTags,
} from "./report-tagging";

describe("organizationLabel", () => {
  it("rend les sigles distincts, triés", () => {
    expect(organizationLabel(["CPAM", "CAF", "CAF"])).toBe("CAF, CPAM");
    expect(organizationLabel(["CAF"])).toBe("CAF");
  });
});

describe("reportTaggingRecipeKey", () => {
  const recipe = {
    model: "modele",
    promptHash: "abc",
    temperature: 0.2,
    taxonomyVersion: 1,
  };

  it("change dès qu'un élément de la recette change", () => {
    const key = reportTaggingRecipeKey(recipe);
    expect(key).toBe("modele:abc:t0.2:v1");
    expect(reportTaggingRecipeKey({ ...recipe, model: "autre" })).not.toBe(key);
    expect(reportTaggingRecipeKey({ ...recipe, promptHash: "def" })).not.toBe(
      key,
    );
    expect(reportTaggingRecipeKey({ ...recipe, temperature: 0 })).not.toBe(key);
    expect(reportTaggingRecipeKey({ ...recipe, taxonomyVersion: 2 })).not.toBe(
      key,
    );
  });
});

describe("storedTags", () => {
  it("garde le libellé fin et projette le tag fermé", () => {
    expect(
      storedTags({ procedureTag: "demande rsa", blockageTag: "dette" }),
    ).toEqual({
      procedureLabel: "demande rsa",
      procedureTag: "RSA",
      blockageLabel: "dette",
      blockageTag: "dette ou retenue",
    });
  });

  it("range une abstention en « inconnu » et un libellé hors liste en null", () => {
    expect(
      storedTags({ procedureTag: null, blockageTag: "libellé inventé" }),
    ).toEqual({
      procedureLabel: null,
      procedureTag: "inconnu",
      blockageLabel: "libellé inventé",
      blockageTag: null,
    });
  });
});
