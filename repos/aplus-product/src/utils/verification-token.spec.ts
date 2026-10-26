import { createInvitationToken } from "./verification-token";

describe("createInvitationToken", () => {
  it("produit 256 bits aléatoires, utilisables tels quels dans une URL", () => {
    expect(createInvitationToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("ne produit jamais deux fois le même jeton", () => {
    const tokens = new Set(
      Array.from({ length: 1000 }, () => createInvitationToken()),
    );
    expect(tokens.size).toBe(1000);
  });
});
