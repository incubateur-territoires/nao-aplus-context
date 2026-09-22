import {
  resolveClientErrorMessage,
  GENERIC_INTERNAL_ERROR_MESSAGE,
} from "./trpc-error-message";

describe("resolveClientErrorMessage", () => {
  const businessError = {
    code: "INTERNAL_SERVER_ERROR",
    message: "Équipe introuvable",
    causeName: "Error",
  };

  it("laisse passer un message métier en production", () => {
    expect(
      resolveClientErrorMessage({ ...businessError, isProduction: true }),
    ).toBe("Équipe introuvable");
  });

  it("masque un message Prisma en production", () => {
    expect(
      resolveClientErrorMessage({
        code: "INTERNAL_SERVER_ERROR",
        message: 'Invalid `prisma.user.findUnique()` : column "nir" ...',
        causeName: "PrismaClientKnownRequestError",
        isProduction: true,
      }),
    ).toBe(GENERIC_INTERNAL_ERROR_MESSAGE);
  });

  it("masque une TypeError en production", () => {
    expect(
      resolveClientErrorMessage({
        code: "INTERNAL_SERVER_ERROR",
        message: "Cannot read properties of undefined (reading 'id')",
        causeName: "TypeError",
        isProduction: true,
      }),
    ).toBe(GENERIC_INTERNAL_ERROR_MESSAGE);
  });

  it("ne masque rien hors production", () => {
    expect(
      resolveClientErrorMessage({
        code: "INTERNAL_SERVER_ERROR",
        message: "détail Prisma",
        causeName: "PrismaClientKnownRequestError",
        isProduction: false,
      }),
    ).toBe("détail Prisma");
  });

  it("ne touche pas aux autres codes d'erreur", () => {
    expect(
      resolveClientErrorMessage({
        code: "FORBIDDEN",
        message: "Vous n'avez pas accès à ce signalement.",
        causeName: "PrismaClientKnownRequestError",
        isProduction: true,
      }),
    ).toBe("Vous n'avez pas accès à ce signalement.");
  });

  it("masque quand la cause est absente", () => {
    expect(
      resolveClientErrorMessage({
        code: "INTERNAL_SERVER_ERROR",
        message: "quelque chose",
        causeName: undefined,
        isProduction: true,
      }),
    ).toBe(GENERIC_INTERNAL_ERROR_MESSAGE);
  });
});
