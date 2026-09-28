import { redactReport, type ReportRedactionInput } from "./redact-report";

jest.mock("./steps/extract-names", () => ({
  extractNamesStep: { name: "extract-names", run: jest.fn() },
}));
jest.mock("./steps/judge-pii", () => ({
  judgePiiStep: { name: "judge-pii", run: jest.fn() },
}));

import { extractNamesStep } from "./steps/extract-names";
import { judgePiiStep } from "./steps/judge-pii";

const extractNames = extractNamesStep.run as jest.Mock;
const judge = judgePiiStep.run as jest.Mock;

function givenNames(...names: string[]): void {
  extractNames.mockReset();
  extractNames.mockResolvedValue({ names });
}

/** Un tableau par tour de juge ; les tours suivants ne trouvent rien. */
function givenJudge(...rounds: string[][]): void {
  judge.mockReset();
  rounds.forEach((residues) => judge.mockResolvedValueOnce({ residues }));
  judge.mockResolvedValue({ residues: [] });
}

function buildInput(
  overrides: Partial<ReportRedactionInput> = {},
): ReportRedactionInput {
  return {
    subject: "Dossier bloqué",
    description: "Karim Benali attend depuis 8 mois.",
    answers: [],
    identity: { firstName: "Karim", lastName: "Benali" },
    participantNames: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  givenNames();
  givenJudge();
});

describe("redactReport", () => {
  it("caviarde le signalement et rend la main quand le juge ne trouve rien", async () => {
    const result = await redactReport(buildInput());

    expect(result.description).toBe("[NOM_2] [NOM_1] attend depuis 8 mois.");
    expect(result.guard.ok).toBe(true);
  });

  it("caviarde les réponses avec les mêmes jetons que le signalement", async () => {
    const result = await redactReport(
      buildInput({
        answers: [
          { id: "a1", content: "Le dossier de Karim Benali est rouvert." },
          { id: "a2", content: "Cordialement, Youssef Amrani." },
        ],
        participantNames: ["Youssef Amrani"],
      }),
    );

    expect(result.answers).toHaveLength(2);
    expect(result.answers[0]).toEqual({
      id: "a1",
      content: "Le dossier de [NOM_2] [NOM_1] est rouvert.",
    });
    // Un nom fourni d'une pièce est un détecteur à part entière : un seul jeton.
    expect(result.answers[1].content).toBe("Cordialement, [NOM_3].");
  });

  it("retire les noms de tiers désignés par la couche B", async () => {
    givenNames("Elena Petrescu");

    const result = await redactReport(
      buildInput({
        description: "Son employeuse, Elena Petrescu, refuse l'attestation.",
      }),
    );

    expect(result.description).toBe(
      "Son employeuse, [NOM_1], refuse l'attestation.",
    );
  });

  it("caviarde littéralement ce que le juge cite, puis le revérifie", async () => {
    givenJudge(["allée des Cerisiers"], []);

    const result = await redactReport(
      buildInput({ description: "Courrier envoyé allée des Cerisiers." }),
    );

    expect(result.description).toBe("Courrier envoyé [DONNEE_1].");
    expect(result.guard.ok).toBe(true);
    expect(judge).toHaveBeenCalledTimes(2);
  });

  it("caviarde aussi ce que le juge ne découvre qu'au second passage", async () => {
    givenJudge(["allée des Cerisiers"], ["56000 Vannes"]);

    const result = await redactReport(
      buildInput({
        description: "Courrier envoyé allée des Cerisiers, 56000 Vannes.",
      }),
    );

    expect(result.description).toBe("Courrier envoyé [DONNEE_1], [DONNEE_2].");
    expect(result.guard.ok).toBe(true);
  });

  it("n'appelle le juge qu'une fois quand il ne trouve rien", async () => {
    const result = await redactReport(buildInput());

    expect(result.guard.ok).toBe(true);
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it("vérifie une dernière fois après deux caviardages, et accepte si le juge se tait", async () => {
    givenJudge(["allée des Cerisiers"], ["56000 Vannes"], []);

    const result = await redactReport(
      buildInput({
        description: "Courrier envoyé allée des Cerisiers, 56000 Vannes.",
      }),
    );

    expect(result.guard.ok).toBe(true);
    expect(judge).toHaveBeenCalledTimes(3);
  });

  it("refuse quand le juge cite encore des résidus après deux caviardages", async () => {
    givenJudge(["rue Haute"], ["56000 Vannes"], ["chez Ali"]);

    const result = await redactReport(
      buildInput({
        description: "Karim Benali habite rue Haute, 56000 Vannes, chez Ali.",
      }),
    );

    expect(judge).toHaveBeenCalledTimes(3);
    expect(result.guard.ok).toBe(false);
    expect(result.guard.violations).toContainEqual({
      type: "RESIDUAL",
      value: "chez Ali",
    });
    // Le dernier passage vérifie sans caviarder : ce qu'il cite n'est pas
    // remplacé, sinon le refus porterait sur un texte déjà corrigé.
    expect(result.description).toBe(
      "[NOM_2] [NOM_1] habite [DONNEE_1], [DONNEE_2], chez Ali.",
    );
  });

  it("découpe un champ plus long que la limite au dernier blanc avant elle", async () => {
    const word = "mot ";
    const description = word.repeat(3_200).trim();

    await redactReport(buildInput({ subject: "", description }));

    const chunks = extractNames.mock.calls.map(
      (call: [{ description: string }]) => call[0].description,
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(12_000);
      expect(chunk.startsWith("mot")).toBe(true);
      expect(chunk.endsWith("mot")).toBe(true);
    }
    // Rien n'est perdu ni coupé au milieu d'un mot.
    expect(chunks.join(" ")).toBe(description);
  });

  it("coupe dur un champ sans aucun blanc", async () => {
    const description = "a".repeat(13_000);

    await redactReport(buildInput({ subject: "", description }));

    const chunks = extractNames.mock.calls.map(
      (call: [{ description: string }]) => call[0].description,
    );
    expect(chunks.map((chunk: string) => chunk.length)).toEqual([
      12_000, 1_000,
    ]);
  });

  it("laisse remonter une panne d'API au lieu de la confondre avec un refus", async () => {
    extractNames.mockReset();
    extractNames.mockRejectedValue(new Error("quota épuisé"));

    await expect(redactReport(buildInput())).rejects.toThrow("quota épuisé");
  });

  it("préserve le sens du dossier", async () => {
    const result = await redactReport(
      buildInput({
        description:
          "RSA de 600 euros non versé depuis 8 mois, relance le 12/01/2024.",
      }),
    );

    expect(result.description).toBe(
      "RSA de 600 euros non versé depuis 8 mois, relance le 12/01/2024.",
    );
  });
});
