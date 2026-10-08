import {
  assemblePseudonymizedContent,
  hasMissingPieces,
  isPseudonymizationCronEnabled,
  missingPieces,
  storedPseudonymizedTexts,
} from "./pseudonymized-report";

const STORED_REPORT = { subject: "Sujet [NOM_1]", description: "Desc [NOM_1]" };

function source(overrides = {}) {
  return {
    pseudonymized: STORED_REPORT,
    answers: [
      { id: "a1", pseudonymized: { content: "Réponse [NOM_2]" } },
      { id: "a2", pseudonymized: { content: "Réponse 2" } },
    ],
    ...overrides,
  };
}

describe("missingPieces", () => {
  it("ne demande rien quand tout est déjà pseudonymisé", () => {
    const missing = missingPieces(source());
    expect(missing).toEqual({ report: false, answerIds: [] });
    expect(hasMissingPieces(missing)).toBe(false);
  });

  it("désigne le sujet et les seules réponses sans texte pseudonymisé", () => {
    const missing = missingPieces(
      source({
        pseudonymized: null,
        answers: [
          { id: "a1", pseudonymized: { content: "x" } },
          { id: "a2", pseudonymized: null },
          { id: "a3" },
        ],
      }),
    );
    expect(missing).toEqual({ report: true, answerIds: ["a2", "a3"] });
    expect(hasMissingPieces(missing)).toBe(true);
  });

  it("compte une réponse en attente comme un morceau manquant", () => {
    expect(
      hasMissingPieces(
        missingPieces(source({ answers: [{ id: "a1", pseudonymized: null }] })),
      ),
    ).toBe(true);
  });
});

describe("storedPseudonymizedTexts", () => {
  it("rend les textes déjà stockés, sujet compris", () => {
    expect(
      storedPseudonymizedTexts(
        source({ answers: [{ id: "a1", pseudonymized: null }] }),
      ),
    ).toEqual(["Sujet [NOM_1]", "Desc [NOM_1]"]);
  });
});

describe("assemblePseudonymizedContent", () => {
  it("assemble le dossier depuis les morceaux stockés", () => {
    expect(assemblePseudonymizedContent(source())).toEqual({
      subject: "Sujet [NOM_1]",
      description: "Desc [NOM_1]",
      answers: [
        { id: "a1", content: "Réponse [NOM_2]" },
        { id: "a2", content: "Réponse 2" },
      ],
    });
  });

  it("refuse d'assembler tant qu'une réponse reste en clair", () => {
    expect(
      assemblePseudonymizedContent(
        source({
          answers: [
            { id: "a1", pseudonymized: { content: "x" } },
            { id: "a2", pseudonymized: null },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("refuse d'assembler sans sujet ni description pseudonymisés", () => {
    expect(
      assemblePseudonymizedContent(source({ pseudonymized: null })),
    ).toBeNull();
  });

  it("complète les morceaux stockés avec ceux qu'on vient d'obtenir", () => {
    const content = assemblePseudonymizedContent(
      source({
        pseudonymized: null,
        answers: [
          { id: "a1", pseudonymized: { content: "Ancienne [NOM_1]" } },
          { id: "a2", pseudonymized: null },
        ],
      }),
      {
        report: { subject: "S [NOM_2]", description: "D" },
        answers: [{ id: "a2", content: "Nouvelle [NOM_2]" }],
      },
    );

    expect(content).toEqual({
      subject: "S [NOM_2]",
      description: "D",
      answers: [
        { id: "a1", content: "Ancienne [NOM_1]" },
        { id: "a2", content: "Nouvelle [NOM_2]" },
      ],
    });
  });

  it("ne remplace jamais un morceau déjà stocké", () => {
    const content = assemblePseudonymizedContent(source(), {
      report: { subject: "autre", description: "autre" },
      answers: [{ id: "a1", content: "autre" }],
    });

    expect(content?.subject).toBe("Sujet [NOM_1]");
    expect(content?.answers[0].content).toBe("Réponse [NOM_2]");
  });
});

describe("isPseudonymizationCronEnabled", () => {
  afterEach(() => {
    delete process.env.REPORT_PSEUDONYMIZATION_CRON_ENABLED;
  });

  it("n'est activé que par la valeur « true »", () => {
    expect(isPseudonymizationCronEnabled()).toBe(false);
    process.env.REPORT_PSEUDONYMIZATION_CRON_ENABLED = "1";
    expect(isPseudonymizationCronEnabled()).toBe(false);
    process.env.REPORT_PSEUDONYMIZATION_CRON_ENABLED = "true";
    expect(isPseudonymizationCronEnabled()).toBe(true);
  });
});
