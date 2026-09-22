import { PII_TYPES } from "@/types/ai-pipeline";
import { checkNoPii } from "./no-pii";

describe("checkNoPii", () => {
  it("valide un résumé propre, sans PII", () => {
    const result = checkNoPii(
      "Le citoyen attend depuis 8 mois le versement de son RSA de 600 euros.",
    );
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("valide un résumé contenant uniquement des jetons de pseudonymisation", () => {
    const result = checkNoPii(
      "M. [NOM_1] attend le versement, joignable au [NUMERO_1].",
    );
    expect(result.ok).toBe(true);
  });

  it("rejette un numéro résiduel (fuite)", () => {
    const result = checkNoPii("Joignable au 0612345678.");
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { type: PII_TYPES.NUMBER, value: "0612345678" },
    ]);
  });

  it("rejette le nom du citoyen réintroduit quand l'identité est fournie", () => {
    const result = checkNoPii("M. Dupont attend une réponse.", {
      firstName: "Jean",
      lastName: "Dupont",
      maritalName: null,
    });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({ type: PII_TYPES.NAME });
  });

  it("laisse passer un nom de tiers halluciné (limite documentée)", () => {
    // « Marie » n'est pas dans le dossier : la couche déterministe ne peut pas
    // savoir que c'est un nom. Ce cas relève de la pseudonymisation LLM (couche B).
    const result = checkNoPii("Sa fille Marie l'accompagne.", {
      firstName: "Jean",
      lastName: "Dupont",
      maritalName: null,
    });
    expect(result.ok).toBe(true);
  });

  it("remonte plusieurs violations", () => {
    const result = checkNoPii("Au 0612345678 et dossier CAF 1234567.");
    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(2);
  });
});
