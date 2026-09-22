import { ROUTE } from "@/app/constant/route";

/**
 * Valide une URL de redirection « returnTo » pour éviter les open redirects.
 *
 * N'autorise que les chemins internes absolus (commençant par « / » mais pas
 * « // » ni « /\ », qui seraient interprétés comme des URLs protocol-relative
 * vers un domaine externe). Retourne ROUTE.ALL_REPORTS par défaut.
 */
export function getSafeReturnTo(returnTo: string | null | undefined): string {
  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    returnTo[1] !== "/" &&
    returnTo[1] !== "\\"
  ) {
    return returnTo;
  }
  return ROUTE.ALL_REPORTS;
}
