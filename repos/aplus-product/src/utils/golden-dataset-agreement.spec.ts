import {
  computeAgreement,
  type AgreementAnnotation,
  type AgreementItem,
} from "@/utils/golden-dataset-agreement";

function annotation(
  annotatorId: string,
  blockageTag: string | null,
  procedureTag: string | null,
): AgreementAnnotation {
  return { annotatorId, blockageTag, procedureTag };
}

function item(...annotations: AgreementAnnotation[]): AgreementItem {
  return { annotations };
}

describe("computeAgreement", () => {
  it("compte un accord par item quand les deux annotateurs posent le même tag", () => {
    const result = computeAgreement([
      item(
        annotation("alice", "dossier bloqué", null),
        annotation("bruno", "dossier bloqué", null),
      ),
      item(
        annotation("alice", "pièce manquante", null),
        annotation("bruno", "pièce manquante", null),
      ),
    ]);

    expect(result.blockageTag).toEqual({
      pairs: [{ a: "alice", b: "bruno", compared: 2, agreed: 2 }],
      compared: 2,
      agreed: 2,
    });
  });

  it("ne compte aucun accord quand les deux annotateurs divergent partout", () => {
    const result = computeAgreement([
      item(
        annotation("alice", "dossier bloqué", null),
        annotation("bruno", "pièce manquante", null),
      ),
      item(
        annotation("alice", "retard", null),
        annotation("bruno", "carte vitale", null),
      ),
    ]);

    expect(result.blockageTag).toEqual({
      pairs: [{ a: "alice", b: "bruno", compared: 2, agreed: 0 }],
      compared: 2,
      agreed: 0,
    });
  });

  it("compte comme accord deux tags qui ne diffèrent que par la casse et les accents", () => {
    const result = computeAgreement([
      item(
        annotation("alice", "Délai Anormal", null),
        annotation("bruno", "delai anormal", null),
      ),
    ]);

    expect(result.blockageTag.compared).toBe(1);
    expect(result.blockageTag.agreed).toBe(1);
  });

  it("ne compare pas un item où un seul des deux a tagué l'axe", () => {
    const result = computeAgreement([
      item(
        annotation("alice", "dossier bloqué", null),
        annotation("bruno", null, "rsa"),
      ),
      item(
        annotation("alice", "retard", null),
        annotation("bruno", "retard", null),
      ),
    ]);

    expect(result.blockageTag).toEqual({
      pairs: [{ a: "alice", b: "bruno", compared: 1, agreed: 1 }],
      compared: 1,
      agreed: 1,
    });
  });

  it("mesure chaque axe indépendamment de l'autre", () => {
    const result = computeAgreement([
      item(
        annotation("alice", "dossier bloqué", "rsa"),
        annotation("bruno", "pièce manquante", "rsa"),
      ),
    ]);

    expect(result.blockageTag).toEqual({
      pairs: [{ a: "alice", b: "bruno", compared: 1, agreed: 0 }],
      compared: 1,
      agreed: 0,
    });
    expect(result.procedureTag).toEqual({
      pairs: [{ a: "alice", b: "bruno", compared: 1, agreed: 1 }],
      compared: 1,
      agreed: 1,
    });
  });

  it("forme trois paires pour trois annotateurs, dans l'ordre de première apparition", () => {
    const result = computeAgreement([
      item(
        annotation("alice", "retard", null),
        annotation("bruno", "retard", null),
      ),
      item(
        annotation("bruno", "retard", null),
        annotation("chloé", "carte vitale", null),
        annotation("alice", "retard", null),
      ),
    ]);

    expect(result.blockageTag.pairs).toEqual([
      { a: "alice", b: "bruno", compared: 2, agreed: 2 },
      { a: "alice", b: "chloé", compared: 1, agreed: 0 },
      { a: "bruno", b: "chloé", compared: 1, agreed: 0 },
    ]);
    expect(result.blockageTag.compared).toBe(4);
    expect(result.blockageTag.agreed).toBe(2);
  });

  it("garde une paire sans aucune comparaison dans la sortie", () => {
    const result = computeAgreement([
      item(annotation("alice", "retard", null)),
      item(annotation("bruno", "retard", null)),
    ]);

    expect(result.blockageTag).toEqual({
      pairs: [{ a: "alice", b: "bruno", compared: 0, agreed: 0 }],
      compared: 0,
      agreed: 0,
    });
  });

  it("rend des paires vides et des compteurs à zéro pour un corpus vide", () => {
    expect(computeAgreement([])).toEqual({
      blockageTag: { pairs: [], compared: 0, agreed: 0 },
      procedureTag: { pairs: [], compared: 0, agreed: 0 },
    });
  });

  it("refuse à la compilation une prédiction de modèle à la place d'une annotation", () => {
    const prediction = {
      runId: "run-1",
      blockageTag: "retard",
      procedureTag: null,
    };

    // @ts-expect-error une prédiction n'est pas une annotation humaine
    const result = computeAgreement([{ annotations: [prediction] }]);

    expect(result.blockageTag.pairs).toEqual([]);
  });

  it("ne forme aucune paire quand un seul annotateur a travaillé", () => {
    const result = computeAgreement([
      item(annotation("alice", "retard", "rsa")),
      item(annotation("alice", "carte vitale", "cmu")),
    ]);

    expect(result).toEqual({
      blockageTag: { pairs: [], compared: 0, agreed: 0 },
      procedureTag: { pairs: [], compared: 0, agreed: 0 },
    });
  });
});
