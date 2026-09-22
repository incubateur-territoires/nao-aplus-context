export const GENERIC_INTERNAL_ERROR_MESSAGE =
  "Une erreur interne est survenue.";

/**
 * Décide du message d'erreur renvoyé au client.
 *
 * Les erreurs métier du dépôt sont levées à la main (`throw new Error(...)`)
 * avec un message destiné à l'utilisateur, que l'interface affiche tel quel :
 * il doit passer. Les erreurs d'infrastructure sont des sous-classes (Prisma,
 * TypeError…) dont le message peut contenir des noms de tables, de contraintes
 * ou d'hôtes : il ne doit jamais sortir en production.
 */
export function resolveClientErrorMessage(params: {
  code: string;
  message: string;
  causeName: string | undefined;
  isProduction: boolean;
}): string {
  const { code, message, causeName, isProduction } = params;

  if (!isProduction || code !== "INTERNAL_SERVER_ERROR") return message;
  // `Error` nu = erreur métier écrite par l'équipe. Toute sous-classe vient
  // d'une bibliothèque et son message est traité comme non publiable.
  if (causeName === "Error") return message;

  return GENERIC_INTERNAL_ERROR_MESSAGE;
}
