import { PII_TYPES } from "@/types/ai-pipeline";
import {
  createCounters,
  findBirthDate,
  highestTokens,
  parseBirthDate,
  pseudonymize,
  pseudonymizeFields,
  pseudonymizeReport,
  redactNames,
} from "./pseudonymize";

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

describe("pseudonymize — motifs fixes", () => {
  it.each([
    ["dans une phrase", "Relance envoyée à jean.dupont@example.org hier."],
    ["en signature", "Pour la suite : accueil@example.com"],
  ])("caviarde une adresse e-mail %s", (_label, text) => {
    const result = pseudonymize(text);
    expect(result.text).toContain("[EMAIL_1]");
    expect(result.matches[0]?.type).toBe(PII_TYPES.EMAIL);
  });

  it("caviarde une référence de dossier sous le seuil numérique", () => {
    const result = pseudonymize("Dossier AB123456 clos par erreur.");
    expect(result.text).toBe("Dossier [DOSSIER_1] clos par erreur.");
  });

  it("préserve un sigle suivi d'un nombre, qui n'est pas une référence", () => {
    const text = "RSA 123456 euros versés en 2023.";
    expect(pseudonymize(text).text).toBe(text);
  });
});

describe("pseudonymizeReport — date de naissance connue", () => {
  it.each([
    ["format français", "12/01/1984", "Né le 12/01/1984, dossier bloqué."],
    ["format ISO", "12/01/1984", "Naissance 1984-01-12 au dossier."],
    ["séparateurs mêlés", "12/01/1984", "État civil : 12-01-1984."],
  ])("caviarde la date de naissance en %s", (_label, birthDate, text) => {
    const result = pseudonymizeReport(
      { subject: "", description: text },
      {
        birthDate,
      },
    );
    expect(result.description).toContain("[DATE_NAISSANCE_1]");
  });

  it.each([
    ["nom du mois", "Né le 12 janvier 1984, dossier bloqué."],
    ["mois abrégé", "Naissance 12 janv. 1984 au dossier."],
    ["mois sans accent", "Née le 12 fevrier 1984."],
  ])(
    "caviarde la date de naissance écrite en toutes lettres : %s",
    (_label, text) => {
      const birthDate = text.includes("fevrier") ? "12/02/1984" : "12/01/1984";
      const result = pseudonymizeReport(
        { subject: "", description: text },
        { birthDate },
      );
      expect(result.description).toContain("[DATE_NAISSANCE_1]");
    },
  );

  it("caviarde une date de naissance saisie en toutes lettres en base", () => {
    const result = pseudonymizeReport(
      { subject: "", description: "Née le 01/01/1944, veuve depuis 2019." },
      { birthDate: "01 JANVIER 1944" },
    );
    expect(result.description).toBe(
      "Née le [DATE_NAISSANCE_1], veuve depuis 2019.",
    );
  });

  it("donne le même jeton aux écritures numérique et littérale", () => {
    const result = pseudonymizeReport(
      {
        subject: "",
        description: "Né le 12/01/1984, soit le 12 janvier 1984.",
      },
      { birthDate: "12/01/1984" },
    );
    expect(result.description).toBe(
      "Né le [DATE_NAISSANCE_1], soit le [DATE_NAISSANCE_1].",
    );
  });

  it("laisse intacte une date qui n'est pas celle de naissance", () => {
    const text = "Relance le 12/01/2024 sans réponse.";
    const result = pseudonymizeReport(
      { subject: "", description: text },
      { birthDate: "12/01/1984" },
    );
    expect(result.description).toBe(text);
  });

  it.each([
    ["mois 25, saisie à l'américaine", "05/25/1980"],
    ["mois 0, saisie bouche-trou", "00/00/1980"],
  ])(
    "caviarde sans planter une date au mois hors bornes : %s",
    (_label, birthDate) => {
      const result = pseudonymizeReport(
        { subject: "", description: `Né le ${birthDate}, dossier bloqué.` },
        { birthDate },
      );
      expect(result.description).toBe(
        "Né le [DATE_NAISSANCE_1], dossier bloqué.",
      );
    },
  );

  it("ignore une date de naissance illisible", () => {
    const text = "Né un jeudi, dossier bloqué.";
    const result = pseudonymizeReport(
      { subject: "", description: text },
      { birthDate: "inconnue" },
    );
    expect(result.description).toBe(text);
  });
});

describe("findBirthDate", () => {
  it("retrouve la date sous une autre écriture que celle stockée", () => {
    expect(
      findBirthDate("Né le 12 janvier 1984, puis 12/01/1984.", "1984-01-12"),
    ).toEqual(["12/01/1984", "12 janvier 1984"]);
  });

  it("ne retrouve rien pour une autre date", () => {
    expect(findBirthDate("Rendez-vous le 13/01/1984.", "1984-01-12")).toEqual(
      [],
    );
  });
});

describe("parseBirthDate", () => {
  it.each([
    ["12/01/1984", { day: 12, month: 1, year: 1984 }],
    ["1984-01-12", { day: 12, month: 1, year: 1984 }],
    ["1.1.2000", { day: 1, month: 1, year: 2000 }],
    ["01 JANVIER 1944", { day: 1, month: 1, year: 1944 }],
    ["1er janvier 1944", { day: 1, month: 1, year: 1944 }],
    ["12 fevrier 1984", { day: 12, month: 2, year: 1984 }],
    ["12 déc. 1984", { day: 12, month: 12, year: 1984 }],
  ])("lit %s", (value, expected) => {
    expect(parseBirthDate(value)).toEqual(expected);
  });

  it.each(["", "inconnue", "12/1984", "32-13-1984-05", "12 brumaire 1984"])(
    "renvoie null sur %s",
    (value) => {
      expect(parseBirthDate(value)).toBeNull();
    },
  );
});

describe("pseudonymizeReport — morphologie des noms", () => {
  it("caviarde un nom de famille qui est aussi une particule", () => {
    const result = pseudonymizeReport(
      { subject: "", description: "Minh Le a appelé : le dossier est bloqué." },
      { firstName: "Minh", lastName: "Le" },
    );
    expect(result.description).not.toMatch(/\bLe\b/);
    expect(result.description).toContain("le dossier est bloqué");
  });

  it("caviarde un nom à particule sans manger les autres particules", () => {
    const result = pseudonymizeReport(
      {
        subject: "",
        description:
          "Le versement de la prime est suspendu. Marc de Vaucelles, France Services.",
      },
      undefined,
      ["Marc de Vaucelles"],
    );
    expect(result.description).toBe(
      "Le versement de la prime est suspendu. [NOM_1], France Services.",
    );
  });

  it("exige une majuscule pour un nom homonyme d'un mot courant", () => {
    const result = pseudonymizeReport(
      {
        subject: "",
        description: "Léa Petit conteste : un petit reste à charge subsiste.",
      },
      { firstName: "Léa", lastName: "Petit" },
    );
    expect(result.description).toBe(
      "[NOM_2] [NOM_1] conteste : un petit reste à charge subsiste.",
    );
  });

  it("reconnaît un prénom écrit sans son diacritique", () => {
    const result = pseudonymizeReport(
      { subject: "", description: "Chaima a déposé un recours." },
      { firstName: "Chaïma" },
    );
    expect(result.description).toBe("[NOM_1] a déposé un recours.");
  });

  it("reconnaît un nom écrit sans son apostrophe", () => {
    const result = pseudonymizeReport(
      { subject: "", description: "Mme Ndiaye a confirmé." },
      undefined,
      ["Awa N'Diaye"],
    );
    expect(result.description).toBe("Mme [NOM_1] a confirmé.");
  });

  it("caviarde un nom composé cité par sa seule seconde partie", () => {
    const result = pseudonymizeReport(
      { subject: "", description: "Mme Legrand relance depuis mars." },
      { lastName: "Nguyen-Legrand" },
    );
    expect(result.description).toBe("Mme [NOM_1] relance depuis mars.");
  });
});

describe("numérotation des jetons entre deux caviardages", () => {
  it("relève le plus haut numéro déjà posé, par type", () => {
    const counters = highestTokens([
      "[NOM_2] a écrit à [NOM_10] au sujet du [DOSSIER_1].",
      "Joint au [NUMERO_3], rien d'autre : [NOM_X] n'est pas un jeton.",
    ]);

    expect(counters[PII_TYPES.NAME]).toBe(10);
    expect(counters[PII_TYPES.CASE_NUMBER]).toBe(1);
    expect(counters[PII_TYPES.NUMBER]).toBe(3);
    expect(counters[PII_TYPES.EMAIL]).toBe(0);
  });

  it("numérote après les jetons déjà posés", () => {
    const offsets = { ...createCounters(), [PII_TYPES.NAME]: 4 };
    const { fields } = pseudonymizeFields(
      [{ key: "answer:a1", text: "Merci Karim Benali." }],
      { firstName: "Karim", lastName: "Benali" },
      [],
      offsets,
    );

    expect(fields[0].text).toBe("Merci [NOM_6] [NOM_5].");
    expect(offsets[PII_TYPES.NAME]).toBe(4);
  });
});
