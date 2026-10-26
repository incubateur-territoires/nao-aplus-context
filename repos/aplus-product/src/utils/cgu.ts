import { CGU_CURRENT_VERSION_DATE } from "@/constants/cgu";

interface CguAcceptanceContext {
  cguAcceptedAt: Date | null;
  impersonatedBy: string | null;
}

// Un administrateur qui se connecte à la place d'un utilisateur ne peut pas
// accepter les CGU en son nom : l'acceptation est personnelle (article 4.1).
export function mustAcceptCurrentCgu({
  cguAcceptedAt,
  impersonatedBy,
}: CguAcceptanceContext): boolean {
  if (impersonatedBy) {
    return false;
  }
  return cguAcceptedAt === null || cguAcceptedAt < CGU_CURRENT_VERSION_DATE;
}
