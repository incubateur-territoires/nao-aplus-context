import { PII_TYPES } from "@/types/ai-pipeline";
import { pseudonymize, pseudonymizeReport, redactNames } from "./pseudonymize";

describe("pseudonymize — détecteur numérique", () => {
  it.each([
    ["CAF à 7 chiffres", "1234567"],
    ["téléphone à 10 chiffres", "0612345678"],
    ["NIR à 13 chiffres", "1801275116207"],
    ["NIR à 15 chiffres", "180127511620716"],
  ])("caviarde un %s", (_label, value) => {
    const result = pseudonymize(`Identifiant ${value} communiqué`);
    expect(result.text).toBe("Identifiant [NUMERO_1] communiqué");
    expect(result.matches[0]?.type).toBe(PII_TYPES.NUMBER);
  });

  it.each(["06 12 34 56 78", "06.12.34.56.78", "1 80 12 75 116 207 16"])(
    "caviarde un numéro avec séparateurs : %s",
    (value) => {
      const result = pseudonymize(`Numéro ${value}.`);
      expect(result.text).toBe("Numéro [NUMERO_1].");
    },
  );

  describe("chiffres courts porteurs de sens préservés", () => {
    it.each([
      "Bloqué depuis 8 mois.",
      "RSA de 600 euros non versé.",
      "Dossier ouvert en 2023.",
      "Relance le 12/01/2024 sans réponse.",
      "3 enfants à charge.",
    ])("laisse intact : %s", (text) => {
      const result = pseudonymize(text);
      expect(result.text).toBe(text);
      expect(result.matches).toHaveLength(0);
    });
  });

  describe("jetons stables", () => {
    it("attribue le même jeton à un numéro répété, même écriture différente", () => {
      const result = pseudonymize("Appeler 06 12 34 56 78 ou le 0612345678.");
      expect(result.text).toBe("Appeler [NUMERO_1] ou le [NUMERO_1].");
      expect(result.matches).toHaveLength(1);
    });

    it("numérote distinctement deux numéros différents", () => {
      const result = pseudonymize("Lignes 0612345678 et 0698765432.");
      expect(result.text).toBe("Lignes [NUMERO_1] et [NUMERO_2].");
      expect(result.matches).toHaveLength(2);
    });
  });

  it("laisse un texte sans PII intact", () => {
    const text = "Blocage du dossier de retraite depuis trois mois.";
    const result = pseudonymize(text);
    expect(result.text).toBe(text);
    expect(result.matches).toHaveLength(0);
  });
});

describe("pseudonymizeReport — dictionnaire de noms", () => {
  const identity = {
    firstName: "Jean",
    lastName: "Dupont",
    maritalName: null,
  };

  it("caviarde le nom du citoyen connu", () => {
    const result = pseudonymizeReport(
      {
        subject: "Dossier Dupont",
        description: "M. Dupont attend depuis 3 mois.",
      },
      identity,
    );
    expect(result.subject).toBe("Dossier [NOM_1]");
    expect(result.description).toBe("M. [NOM_1] attend depuis 3 mois.");
    expect(result.matches.every((m) => m.type === PII_TYPES.NAME)).toBe(true);
  });

  it("caviarde indépendamment de la casse", () => {
    const result = pseudonymizeReport(
      { subject: "", description: "DUPONT, dupont et Dupont." },
      identity,
    );
    expect(result.description).toBe("[NOM_1], [NOM_1] et [NOM_1].");
  });

  it("gère un prénom accenté en initiale", () => {
    const result = pseudonymizeReport(
      { subject: "", description: "Étienne a appelé." },
      { firstName: "Étienne", lastName: null, maritalName: null },
    );
    expect(result.description).toBe("[NOM_1] a appelé.");
  });

  it("ne caviarde pas un tiers inconnu du dossier", () => {
    const result = pseudonymizeReport(
      { subject: "", description: "Sa fille Marie l'accompagne." },
      identity,
    );
    expect(result.description).toBe("Sa fille Marie l'accompagne.");
    expect(result.matches).toHaveLength(0);
  });

  it("ne touche pas le texte sans identité fournie", () => {
    const result = pseudonymizeReport({
      subject: "Dossier Dupont",
      description: "M. Dupont.",
    });
    expect(result.subject).toBe("Dossier Dupont");
    expect(result.description).toBe("M. Dupont.");
  });

  it("partage les jetons numériques entre subject et description", () => {
    const result = pseudonymizeReport({
      subject: "Problème pour 0612345678",
      description: "Le citoyen au 0612345678 attend.",
    });
    expect(result.subject).toBe("Problème pour [NUMERO_1]");
    expect(result.description).toBe("Le citoyen au [NUMERO_1] attend.");
    expect(result.matches).toHaveLength(1);
  });

  it("caviarde des noms supplémentaires fournis (extraNames)", () => {
    const result = pseudonymizeReport(
      { subject: "", description: "Sa fille Marie accompagne M. Dupont." },
      { firstName: "Jean", lastName: "Dupont", maritalName: null },
      ["Marie"],
    );
    expect(result.description).toBe("Sa fille [NOM_2] accompagne M. [NOM_1].");
  });

  it("combine nom et numéro dans un même signalement", () => {
    const result = pseudonymizeReport(
      {
        subject: "Dupont bloqué",
        description:
          "M. Dupont, joignable au 0612345678, attend depuis 8 mois.",
      },
      identity,
    );
    expect(result.subject).toBe("[NOM_1] bloqué");
    expect(result.description).toBe(
      "M. [NOM_1], joignable au [NUMERO_1], attend depuis 8 mois.",
    );
    const types = result.matches.map((m) => m.type);
    expect(types).toEqual(
      expect.arrayContaining([PII_TYPES.NAME, PII_TYPES.NUMBER]),
    );
  });
});

describe("redactNames (couche B, volet déterministe)", () => {
  it("caviarde les noms fournis en continuant la numérotation [NOM_n]", () => {
    // Couche A a déjà produit [NOM_1] (le citoyen) ; on caviarde un tiers.
    const result = redactNames(
      { subject: "", description: "M. [NOM_1] est accompagné de destouches." },
      ["destouches"],
      1,
    );
    expect(result.description).toBe("M. [NOM_1] est accompagné de [NOM_2].");
    expect(result.matches[0]).toMatchObject({
      type: PII_TYPES.NAME,
      value: "destouches",
      placeholder: "[NOM_2]",
    });
  });

  it("ne touche à rien si la liste de noms est vide", () => {
    const result = redactNames(
      { subject: "", description: "M. [NOM_1] attend." },
      [],
      1,
    );
    expect(result.description).toBe("M. [NOM_1] attend.");
    expect(result.matches).toHaveLength(0);
  });
});
