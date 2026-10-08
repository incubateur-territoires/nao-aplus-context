import { buildReportTaggingMessage } from "./mattermost-messages";

function summary(overrides = {}) {
  return {
    model: "modele",
    tagged: 8,
    refused: 1,
    errors: [],
    outage: false,
    callsUsed: 9,
    callLimit: 3000,
    ...overrides,
  };
}

describe("buildReportTaggingMessage", () => {
  it("résume le run en compteurs seulement", () => {
    const message = buildReportTaggingMessage(summary());

    expect(message).toContain("Étiquetés : **8** · **1** refus");
    expect(message).toContain("**9** / 3000");
    expect(message).not.toContain("erreur");
    expect(message).not.toContain("indisponible");
  });

  it("signale les erreurs et une panne sans identifiant", () => {
    const message = buildReportTaggingMessage(
      summary({ errors: [{ reportId: "r1" }], outage: true }),
    );

    expect(message).toContain("**1** erreur(s)");
    expect(message).toContain("Pipeline indisponible");
    expect(message).not.toContain("r1");
  });

  it("dit que rien n'a tourné sans modèle configuré", () => {
    const message = buildReportTaggingMessage(summary({ model: null }));

    expect(message).toContain("aucun modèle configuré");
    expect(message).not.toContain("Étiquetés");
  });
});
