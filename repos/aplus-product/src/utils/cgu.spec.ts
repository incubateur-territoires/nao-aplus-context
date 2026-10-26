import { mustAcceptCurrentCgu } from "./cgu";

describe("mustAcceptCurrentCgu", () => {
  it("exige l'acceptation quand l'utilisateur n'a jamais accepté les CGU", () => {
    expect(
      mustAcceptCurrentCgu({ cguAcceptedAt: null, impersonatedBy: null }),
    ).toBe(true);
  });

  it("exige l'acceptation quand la dernière acceptation précède la version en vigueur", () => {
    expect(
      mustAcceptCurrentCgu({
        cguAcceptedAt: new Date("2026-09-30T21:59:59Z"),
        impersonatedBy: null,
      }),
    ).toBe(true);
  });

  it("n'exige rien quand la version en vigueur a déjà été acceptée", () => {
    expect(
      mustAcceptCurrentCgu({
        cguAcceptedAt: new Date("2026-09-30T22:00:00Z"),
        impersonatedBy: null,
      }),
    ).toBe(false);
  });

  it("n'exige rien pendant une connexion en tant qu'un autre utilisateur", () => {
    expect(
      mustAcceptCurrentCgu({ cguAcceptedAt: null, impersonatedBy: "admin-id" }),
    ).toBe(false);
  });
});
