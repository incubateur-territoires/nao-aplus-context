import { buildDeletedReportsMessage } from "./mattermost-messages";

function summary(overrides = {}) {
  return {
    reportsDeleted: [{ id: "report-1234-abcd" }],
    pseudonymized: [],
    awaitingPseudonymization: [],
    contentErased: [],
    pseudonymizationOutage: false,
    pseudonymizationEnabled: true,
    fileErrors: [],
    errors: [],
    ...overrides,
  };
}

describe("buildDeletedReportsMessage — caviardage", () => {
  it("ne mentionne pas le texte quand rien n'a été caviardé", () => {
    const message = buildDeletedReportsMessage(summary());
    expect(message).not.toContain("Texte :");
  });

  it("ne mentionne pas le texte quand le pipeline est désactivé", () => {
    // Drapeau éteint, le texte est remplacé comme avant : rien de neuf à dire.
    const message = buildDeletedReportsMessage(
      summary({
        pseudonymizationEnabled: false,
        contentErased: [{ id: "a" }, { id: "b" }],
      }),
    );

    expect(message).not.toContain("Texte :");
    expect(message).toContain("**1** signalement(s) anonymisé(s)");
  });

  it("résume le sort des textes", () => {
    const message = buildDeletedReportsMessage(
      summary({
        pseudonymized: [{ id: "a" }, { id: "b" }],
        awaitingPseudonymization: [{ id: "c" }],
        contentErased: [{ id: "d" }],
      }),
    );

    expect(message).toContain("**2** caviardé(s)");
    expect(message).toContain("**1** en attente");
    expect(message).toContain("**1** remplacé(s)");
  });

  it("alerte sur une indisponibilité en rappelant que rien n'a été remplacé", () => {
    const message = buildDeletedReportsMessage(
      summary({
        awaitingPseudonymization: [{ id: "c" }, { id: "d" }],
        pseudonymizationOutage: true,
      }),
    );

    expect(message).toContain("Pipeline de caviardage indisponible");
    expect(message).toContain("**2** texte(s) attendent");
    expect(message).toContain("Aucun contenu n'a été remplacé");
  });

  it("ne liste aucun identifiant, quel que soit le volume", () => {
    const reportsDeleted = Array.from({ length: 300 }, (_, index) => ({
      id: `report-${index}-abcd`,
    }));
    const message = buildDeletedReportsMessage(summary({ reportsDeleted }));

    expect(message).toContain("**300** signalement(s)");
    expect(message).not.toContain("report-");
  });

  it("annonce les erreurs en tête et renvoie leur détail vers Sentry", () => {
    const message = buildDeletedReportsMessage(
      summary({
        errors: [
          { reportId: "report-1234-abcd", error: "Transaction expirée" },
          { reportId: "report-5678-efgh", error: "Transaction expirée" },
        ],
      }),
    );

    const [, firstLine] = message.split("\n\n");
    expect(firstLine).toContain("**2** erreur(s)");
    expect(firstLine).toContain("Sentry");
    expect(message).not.toContain("report-");
    expect(message).not.toContain("Transaction expirée");
  });
});
