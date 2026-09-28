import { ANONYMIZED_IDENTITY } from "./anonymize-report";

describe("ANONYMIZED_IDENTITY", () => {
  it("n'invente aucun identifiant qui pourrait être celui d'une personne réelle", () => {
    expect(ANONYMIZED_IDENTITY).toEqual({
      firstName: "Anonymisé",
      lastName: "Anonymisé",
      maritalName: null,
      birthDate: "00/00/0000",
      phone: null,
      nir: null,
      caf: null,
      nif: null,
    });
  });
});
