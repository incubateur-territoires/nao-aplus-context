import { parseLlmList } from "./parse-list";

describe("parseLlmList", () => {
  it("écarte une citation qui n'est qu'une civilité autour d'un jeton", () => {
    expect(
      parseLlmList("Mme [DONNEE_1], [DONNEE_10] [NOM_2], Mme [[DONNEE_2]]"),
    ).toEqual([]);
  });

  it("garde ce qui reste en clair à côté d'un jeton", () => {
    expect(parseLlmList("M. [NOM_1] Durand, [NOM_2] 12 rue des Lilas")).toEqual(
      ["Durand", "12 rue des Lilas"],
    );
  });

  it("lit une liste séparée par des virgules", () => {
    expect(parseLlmList("Jean Dupont, Marie Durand")).toEqual([
      "Jean Dupont",
      "Marie Durand",
    ]);
  });

  it("lit une liste à puces sur plusieurs lignes", () => {
    expect(parseLlmList("- Jean Dupont\n- Marie Durand")).toEqual([
      "Jean Dupont",
      "Marie Durand",
    ]);
  });

  it.each(["AUCUN", "aucune", "Aucun.", "AUCUNES"])(
    "renvoie une liste vide sur %s",
    (answer) => {
      expect(parseLlmList(answer)).toEqual([]);
    },
  );

  it("ignore les jetons de pseudonymisation", () => {
    expect(parseLlmList("[NOM_1], [DATE_NAISSANCE_2], Jean")).toEqual(["Jean"]);
  });

  it("retire les guillemets autour d'une valeur citée", () => {
    expect(parseLlmList('« allée des Cerisiers », "Jean"')).toEqual([
      "allée des Cerisiers",
      "Jean",
    ]);
  });

  it("déduplique sans tenir compte de la casse", () => {
    expect(parseLlmList("Dupont, dupont, DUPONT")).toEqual(["Dupont"]);
  });

  it("renvoie une liste vide sur une réponse vide", () => {
    expect(parseLlmList("   ")).toEqual([]);
  });
});
