import { matchTags, NATURES, THEMES } from "./taxonomy";

describe("matchTags", () => {
  it("retient les libellés présents dans une réponse formatée", () => {
    const output = "THEMES: Retraite\nNATURES: Versement, Retard";
    expect(matchTags(output, THEMES)).toEqual(["Retraite"]);
    expect(matchTags(output, NATURES)).toEqual(["Versement", "Retard"]);
  });

  it("est insensible à la casse et aux accents", () => {
    const output = "themes: fiscalite, etat civil";
    expect(matchTags(output, THEMES)).toEqual(
      expect.arrayContaining(["Fiscalité", "État civil"]),
    );
  });

  it("ignore les libellés hors vocabulaire (anti-hallucination)", () => {
    const output = "THEMES: Cryptomonnaie, Santé\nNATURES: Téléportation";
    expect(matchTags(output, THEMES)).toEqual(["Santé"]);
    expect(matchTags(output, NATURES)).toEqual([]);
  });

  it("fonctionne aussi sur une réponse en prose", () => {
    const output =
      "Le citoyen rencontre un blocage de versement lié à l'emploi.";
    expect(matchTags(output, THEMES)).toEqual(["Emploi"]);
    expect(matchTags(output, NATURES)).toEqual(["Versement"]);
  });

  it("ne matche pas un libellé inclus dans un autre mot", () => {
    // « Emploi » ne doit pas être détecté dans « remploi », ni « Retard » dans « Retraite ».
    const output = "Question de retraite";
    expect(matchTags(output, NATURES)).not.toContain("Retard");
  });

  it("renvoie un tableau vide si rien ne correspond", () => {
    expect(matchTags("Aucun rapport", THEMES)).toEqual([]);
  });
});
