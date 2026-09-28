import { GOLDEN_TAG_AXES } from "@/utils/golden-dataset-golden-tags";
import { sameTag, UNDETERMINED_GOLDEN_TAG } from "@/utils/golden-dataset-tag";
import {
  closedTagsOf,
  renderFineLabelPrompt,
  renderTaxonomyPrompt,
} from "@/utils/golden-dataset-taxonomy";
import { CURRENT_GOLDEN_TAXONOMY } from "@/utils/golden-dataset-taxonomy-current";
import { toBlindItem } from "./blind-item";
import {
  GOLDEN_TAG_SYSTEM_PROMPT,
  GOLDEN_TAG_USER_TEMPLATE,
  goldenTagStep,
  parseGoldenTags,
  promptHash,
  renderPrompt,
  selectSystemPrompt,
} from "./golden-tag";

jest.mock("ai", () => ({ generateText: jest.fn() }));
jest.mock("../providers", () => ({ albertChatModel: jest.fn() }));

import { generateText } from "ai";

const generateTextMock = generateText as jest.Mock;

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

  it("garde son hash, celui des séries en texte libre déjà en base", () => {
    expect(promptHash(GOLDEN_TAG_SYSTEM_PROMPT, GOLDEN_TAG_USER_TEMPLATE)).toBe(
      "3c6a7bf3cd68175fe987a27e876b2bb70be429e3a9f434f3fb2e602e1a3851db",
    );
  });
});

describe("selectSystemPrompt", () => {
  it("garde la consigne en texte libre quand TAXONOMY est absente", () => {
    expect(selectSystemPrompt(undefined).systemPrompt).toBe(
      GOLDEN_TAG_SYSTEM_PROMPT,
    );
  });

  it("rend la liste fermée en cours pour « closed », avec chacun de ses tags", () => {
    const { systemPrompt } = selectSystemPrompt("closed");

    expect(systemPrompt).toBe(renderTaxonomyPrompt(CURRENT_GOLDEN_TAXONOMY));
    for (const axis of GOLDEN_TAG_AXES) {
      for (const tag of closedTagsOf(CURRENT_GOLDEN_TAXONOMY, axis)) {
        expect(systemPrompt).toContain(tag);
      }
    }
  });

  it("rend les labels fins en cours pour « fine »", () => {
    expect(selectSystemPrompt("fine").systemPrompt).toBe(
      renderFineLabelPrompt(CURRENT_GOLDEN_TAXONOMY),
    );
  });

  it("nomme le mode et la version de liste que la consigne expose", () => {
    const version = CURRENT_GOLDEN_TAXONOMY.version;
    expect(selectSystemPrompt(undefined)).toMatchObject({
      mode: "free",
      taxonomyVersion: null,
    });
    expect(selectSystemPrompt("closed")).toMatchObject({
      mode: "closed",
      taxonomyVersion: version,
    });
    expect(selectSystemPrompt("fine")).toMatchObject({
      mode: "fine",
      taxonomyVersion: version,
    });
  });

  it("refuse toute autre valeur, vide comprise, plutôt que de deviner", () => {
    for (const taxonomy of ["fermee", ""]) {
      expect(() => selectSystemPrompt(taxonomy)).toThrow(
        `TAXONOMY « ${taxonomy} » inconnue`,
      );
    }
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

  it("retire les guillemets que le modèle recopie depuis la liste fermée", () => {
    expect(
      parseGoldenTags(
        "BLOCAGE: « versement bloqué »\nDEMARCHE: « complémentaire santé (C2S) »",
      ),
    ).toEqual({
      blockageTag: "versement bloqué",
      procedureTag: "complémentaire santé (C2S)",
    });
  });

  it("relit intact chaque tag de la liste fermée en cours, « inconnu » valant abstention", () => {
    for (const tag of closedTagsOf(CURRENT_GOLDEN_TAXONOMY, "blockageTag")) {
      expect({
        tag,
        read: parseGoldenTags(`BLOCAGE: ${tag}`).blockageTag,
      }).toEqual({
        tag,
        read: sameTag(tag, UNDETERMINED_GOLDEN_TAG) ? null : tag,
      });
    }
    for (const tag of closedTagsOf(CURRENT_GOLDEN_TAXONOMY, "procedureTag")) {
      expect({
        tag,
        read: parseGoldenTags(`DEMARCHE: ${tag}`).procedureTag,
      }).toEqual({
        tag,
        read: sameTag(tag, UNDETERMINED_GOLDEN_TAG) ? null : tag,
      });
    }
  });
});

describe("goldenTagStep", () => {
  it("envoie la consigne de la recette et lit la réponse du modèle", async () => {
    generateTextMock.mockResolvedValue({
      text: "BLOCAGE: aucun\nDEMARCHE: autre",
    });

    const output = await goldenTagStep.run({
      item: blindItem("Description caviardée de [NOM_1]."),
      recipe: {
        model: "modele-test",
        systemPrompt: "consigne de la recette",
        temperature: 0.2,
      },
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "consigne de la recette",
        temperature: 0.2,
      }),
    );
    expect(output).toEqual({
      blockageTag: "aucun",
      procedureTag: "autre",
      rawOutput: "BLOCAGE: aucun\nDEMARCHE: autre",
    });
  });
});
