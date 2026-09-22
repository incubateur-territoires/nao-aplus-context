import { parseFreeTags, parseSummaryAndTags } from "./tag-axes";

describe("parseFreeTags", () => {
  it("extrait un tag par axe, dans l'ordre des axes", () => {
    const text = [
      "BLOCAGE: radiation injustifiée",
      "ORGANISME: CAF",
      "URGENCE: expulsion imminente",
      "DEMARCHE: demande RSA",
    ].join("\n");

    expect(parseFreeTags(text)).toEqual([
      { axis: "organisme", label: "caf" },
      { axis: "demarche", label: "demande rsa" },
      { axis: "blocage", label: "radiation injustifiée" },
      { axis: "urgence", label: "expulsion imminente" },
    ]);
  });

  it("tolère les décorations du modèle (puces, gras, accents)", () => {
    const text =
      "- **DÉMARCHE**: « titre de séjour »\n* Organisme : préfecture";

    expect(parseFreeTags(text)).toEqual([
      { axis: "organisme", label: "préfecture" },
      { axis: "demarche", label: "titre de séjour" },
    ]);
  });

  it("écarte les libellés creux ou vides", () => {
    const text = [
      "ORGANISME: CPAM",
      "DEMARCHE: inconnu",
      "BLOCAGE: administratif",
      "URGENCE: aucune urgence",
    ].join("\n");

    expect(parseFreeTags(text)).toEqual([{ axis: "organisme", label: "cpam" }]);
  });

  it("écarte aussi les libellés vides en anglais", () => {
    const text = ["ORGANISME: unknown", "DEMARCHE: none"].join("\n");

    expect(parseFreeTags(text)).toEqual([]);
  });

  it("fusionne les synonymes récurrents vers un libellé canonique", () => {
    const text = [
      "ORGANISME: pôle emploi",
      "BLOCAGE: dossier sans réponse",
      "URGENCE: perte de ressources",
    ].join("\n");

    expect(parseFreeTags(text)).toEqual([
      { axis: "organisme", label: "france travail" },
      { axis: "blocage", label: "absence de réponse" },
      { axis: "urgence", label: "rupture de ressources" },
    ]);
  });

  it("canonicalise indépendamment des accents et de la casse", () => {
    expect(parseFreeTags("BLOCAGE: Non-Réponse")).toEqual([
      { axis: "blocage", label: "absence de réponse" },
    ]);
  });

  it("ne garde que la première valeur quand le modèle en liste plusieurs", () => {
    expect(parseFreeTags("ORGANISME: CAF, CPAM")).toEqual([
      { axis: "organisme", label: "caf" },
    ]);
  });

  it("ignore les lignes hors format et les axes répétés", () => {
    const text = [
      "Voici les tags :",
      "ORGANISME: impôts",
      "ORGANISME: mairie",
    ].join("\n");

    expect(parseFreeTags(text)).toEqual([
      { axis: "organisme", label: "impôts" },
    ]);
  });
});

describe("parseSummaryAndTags", () => {
  it("sépare le résumé (multi-lignes, préfixe retiré) des lignes d'axes", () => {
    const text = [
      "RESUME: [NOM_1] attend sa pension depuis 4 mois.",
      "La CARSAT ne répond pas.",
      "ORGANISME: carsat",
      "DEMARCHE: pension de retraite",
      "BLOCAGE: absence de réponse",
      "URGENCE: rupture de ressources",
    ].join("\n");

    expect(parseSummaryAndTags(text)).toEqual({
      summary:
        "[NOM_1] attend sa pension depuis 4 mois.\nLa CARSAT ne répond pas.",
      tags: [
        { axis: "organisme", label: "carsat" },
        { axis: "demarche", label: "pension de retraite" },
        { axis: "blocage", label: "absence de réponse" },
        { axis: "urgence", label: "rupture de ressources" },
      ],
    });
  });

  it("tolère l'absence de préfixe RESUME et de tags", () => {
    expect(parseSummaryAndTags("Un simple résumé sans tags.")).toEqual({
      summary: "Un simple résumé sans tags.",
      tags: [],
    });
  });

  it("ne confond pas un deux-points du résumé avec une ligne d'axe", () => {
    const text = [
      "Résumé : la situation est bloquée depuis mars.",
      "BLOCAGE: trop-perçu contesté",
    ].join("\n");

    expect(parseSummaryAndTags(text)).toEqual({
      summary: "la situation est bloquée depuis mars.",
      tags: [{ axis: "blocage", label: "trop-perçu contesté" }],
    });
  });
});
