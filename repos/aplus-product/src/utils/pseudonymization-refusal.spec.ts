import { ReportPseudonymizationRefusalKind } from "@/generated/prisma/enums";
import { PII_TYPES } from "@/types/ai-pipeline";
import { guardRefusal, providerRefusal } from "./pseudonymization-refusal";

describe("guardRefusal", () => {
  it("compte les violations par type", () => {
    const refusal = guardRefusal([
      { type: PII_TYPES.RESIDUAL, value: "Dupont" },
      { type: PII_TYPES.RESIDUAL, value: "Martin" },
      { type: PII_TYPES.NUMBER, value: "0612345678" },
    ]);

    expect(refusal).toEqual({
      kind: ReportPseudonymizationRefusalKind.GUARD,
      violationCounts: { RESIDUAL: 2, NUMBER: 1 },
    });
  });

  it("ne garde aucune valeur restée en clair", () => {
    const refusal = guardRefusal([
      { type: PII_TYPES.EMAIL, value: "personne@example.org" },
    ]);

    expect(JSON.stringify(refusal)).not.toContain("personne@example.org");
  });
});

describe("providerRefusal", () => {
  it("garde le statut HTTP du rejet", () => {
    expect(providerRefusal(422)).toEqual({
      kind: ReportPseudonymizationRefusalKind.PROVIDER,
      providerStatus: 422,
    });
  });

  it("n'invente pas de statut inconnu", () => {
    expect(providerRefusal(undefined)).toEqual({
      kind: ReportPseudonymizationRefusalKind.PROVIDER,
    });
  });
});
