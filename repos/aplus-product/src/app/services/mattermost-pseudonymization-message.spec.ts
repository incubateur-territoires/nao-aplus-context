import { buildReportPseudonymizationMessage } from "./mattermost-messages";

function summary(overrides = {}) {
  return {
    reportsPseudonymized: 5,
    answersPseudonymized: 12,
    refused: 1,
    errors: [],
    outage: false,
    callsUsed: 30,
    callLimit: 900,
    reportsAwaiting: 100,
    answersAwaiting: 400,
    ...overrides,
  };
}

describe("buildReportPseudonymizationMessage", () => {
  it("résume le run en compteurs seulement", () => {
    const message = buildReportPseudonymizationMessage(summary());

    expect(message).toContain(
      "**5** signalement(s) · **12** réponse(s) · **1** refus",
    );
    expect(message).toContain(
      "En attente : **100** signalement(s) · **400** réponse(s)",
    );
    expect(message).toContain("**30** / 900");
    expect(message).not.toContain("erreur");
    expect(message).not.toContain("indisponible");
  });

  it("signale les erreurs et une panne", () => {
    const message = buildReportPseudonymizationMessage(
      summary({
        errors: [{ reportId: "r1" }],
        outage: true,
      }),
    );

    expect(message).toContain("**1** erreur(s)");
    expect(message).toContain("Pipeline de caviardage indisponible");
    expect(message).not.toContain("r1");
  });
});
