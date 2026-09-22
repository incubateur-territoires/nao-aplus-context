import { toBlindItem } from "./blind-item";
import {
  GOLDEN_TAG_SYSTEM_PROMPT,
  GOLDEN_TAG_USER_TEMPLATE,
  parseGoldenTags,
  promptHash,
  renderPrompt,
} from "./golden-tag";

function blindItem(description: string) {
  return toBlindItem({
    id: "item-1",
    organization: "CAF",
    subject: "Sujet caviardé",
    description,
  });
}

describe("GOLDEN_TAG_SYSTEM_PROMPT", () => {
  it("reprend les exemples affichés aux annotateurs humains", () => {
    expect(GOLDEN_TAG_SYSTEM_PROMPT).toContain(
      "compte inactif, retard, bug informatique",
    );
    expect(GOLDEN_TAG_SYSTEM_PROMPT).toContain(
      "demande de RSA, perte de carte d'identité",
    );
  });
});

describe("renderPrompt", () => {
  it("substitue les trois placeholders du gabarit", () => {
    const rendered = renderPrompt(
      GOLDEN_TAG_USER_TEMPLATE,
      blindItem("Description caviardée de [NOM_1]."),
    );

    expect(rendered).toBe(
      [
        "Organisme sollicité : CAF",
        "",
        "Sujet : Sujet caviardé",
        "",
        "Description : Description caviardée de [NOM_1].",
      ].join("\n"),
    );
  });

  it("recopie littéralement un texte contenant des motifs de remplacement", () => {
    const rendered = renderPrompt(
      "Description : {{description}}",
      blindItem("Un montant noté $& puis $' dans le dossier."),
    );

    expect(rendered).toBe(
      "Description : Un montant noté $& puis $' dans le dossier.",
    );
  });
});

describe("promptHash", () => {
  it("produit un sha256 hexadécimal stable", () => {
    const hash = promptHash(GOLDEN_TAG_SYSTEM_PROMPT, GOLDEN_TAG_USER_TEMPLATE);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(
      promptHash(GOLDEN_TAG_SYSTEM_PROMPT, GOLDEN_TAG_USER_TEMPLATE),
    );
  });

  it("change dès que le gabarit change", () => {
    expect(promptHash("consigne", "gabarit")).not.toBe(
      promptHash("consigne", "gabarit modifié"),
    );
  });
});

describe("parseGoldenTags", () => {
  it("lit les deux axes de la réponse attendue", () => {
    expect(
      parseGoldenTags(
        "BLOCAGE: justificatif non traité\nDEMARCHE: versement RSA",
      ),
    ).toEqual({
      blockageTag: "justificatif non traité",
      procedureTag: "versement RSA",
    });
  });

  it("garde une réponse plus longue que la consigne de 5 mots", () => {
    expect(
      parseGoldenTags(
        "BLOCAGE: absence de réponse et justificatif refusé\nDEMARCHE: demande de RSA",
      ),
    ).toEqual({
      blockageTag: "absence de réponse et justificatif refusé",
      procedureTag: "demande de RSA",
    });
  });

  it("conserve la casse écrite par le modèle, sans canonicalisation", () => {
    expect(parseGoldenTags("BLOCAGE: Non-Réponse")).toEqual({
      blockageTag: "Non-Réponse",
      procedureTag: null,
    });
  });

  it("tolère l'ordre inverse et les décorations", () => {
    expect(
      parseGoldenTags(
        "- **DEMARCHE**: perte de carte d'identité\n- **BLOCAGE**: compte inactif",
      ),
    ).toEqual({
      blockageTag: "compte inactif",
      procedureTag: "perte de carte d'identité",
    });
  });

  it("rend null pour un axe indéterminable et pour un axe absent", () => {
    expect(parseGoldenTags("BLOCAGE: inconnu")).toEqual({
      blockageTag: null,
      procedureTag: null,
    });
  });

  it("rend null pour les autres formulations d'indétermination", () => {
    expect(parseGoldenTags("BLOCAGE: Inconnue\nDEMARCHE: N/A")).toEqual({
      blockageTag: null,
      procedureTag: null,
    });
  });
});
