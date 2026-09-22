import {
  toggleGoldenTag,
  type GoldenTags,
} from "@/utils/golden-dataset-golden-tags";

const NOTHING_RETAINED: GoldenTags = {
  blockageTag: null,
  procedureTag: null,
};

describe("toggleGoldenTag", () => {
  it("retient un texte quand l'axe est vide", () => {
    expect(
      toggleGoldenTag(NOTHING_RETAINED, "blockageTag", "dossier bloqué"),
    ).toEqual({ blockageTag: "dossier bloqué", procedureTag: null });
  });

  it("relâche le texte déjà retenu", () => {
    expect(
      toggleGoldenTag(
        { blockageTag: "dossier bloqué", procedureTag: null },
        "blockageTag",
        "dossier bloqué",
      ),
    ).toEqual({ blockageTag: null, procedureTag: null });
  });

  it("remplace le texte retenu par le nouveau", () => {
    expect(
      toggleGoldenTag(
        { blockageTag: "dossier bloqué", procedureTag: null },
        "blockageTag",
        "pièce manquante",
      ),
    ).toEqual({ blockageTag: "pièce manquante", procedureTag: null });
  });

  it("laisse l'autre axe intact", () => {
    expect(
      toggleGoldenTag(
        { blockageTag: "dossier bloqué", procedureTag: "rsa" },
        "procedureTag",
        "prime activité",
      ),
    ).toEqual({
      blockageTag: "dossier bloqué",
      procedureTag: "prime activité",
    });
  });

  it("distingue les deux axes sur un même texte", () => {
    const retained: GoldenTags = {
      blockageTag: "carte vitale",
      procedureTag: null,
    };

    expect(toggleGoldenTag(retained, "procedureTag", "carte vitale")).toEqual({
      blockageTag: "carte vitale",
      procedureTag: "carte vitale",
    });
  });

  it("relâche l'axe quand le texte cliqué est équivalent au retenu", () => {
    expect(
      toggleGoldenTag(
        { blockageTag: "Retard CPAM", procedureTag: null },
        "blockageTag",
        "retard cpam",
      ),
    ).toEqual({ blockageTag: null, procedureTag: null });
  });

  it("remplace le retenu quand le texte cliqué n'est pas équivalent", () => {
    expect(
      toggleGoldenTag(
        { blockageTag: "Retard CPAM", procedureTag: null },
        "blockageTag",
        "retard CAF",
      ),
    ).toEqual({ blockageTag: "retard CAF", procedureTag: null });
  });

  it("ne fait pas jouer l'équivalence d'un axe sur l'autre", () => {
    expect(
      toggleGoldenTag(
        { blockageTag: "Retard CPAM", procedureTag: null },
        "procedureTag",
        "retard cpam",
      ),
    ).toEqual({ blockageTag: "Retard CPAM", procedureTag: "retard cpam" });
  });

  it("ne modifie pas l'état reçu", () => {
    const retained: GoldenTags = {
      blockageTag: "dossier bloqué",
      procedureTag: null,
    };

    toggleGoldenTag(retained, "blockageTag", "pièce manquante");

    expect(retained).toEqual({
      blockageTag: "dossier bloqué",
      procedureTag: null,
    });
  });
});
