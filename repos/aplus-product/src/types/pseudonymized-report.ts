import type { ReportPseudonymizationRefusalKind } from "@/generated/prisma/enums";
import type { PiiType } from "@/types/ai-pipeline";

/** Texte pseudonymisé d'un dossier complet, prêt à remplacer le texte réel. */
export interface PseudonymizedContent {
  subject: string;
  description: string;
  answers: { id: string; content: string }[];
}

/** Un signalement et les morceaux pseudonymisés déjà stockés, réponse par réponse. */
export interface StoredPseudonymizationSource {
  pseudonymized?: { subject: string; description: string } | null;
  answers: { id: string; pseudonymized?: { content: string } | null }[];
}

/** Morceaux pseudonymisés par un appel, à ajouter à ceux déjà stockés. */
export interface PseudonymizedPieces {
  report: { subject: string; description: string } | null;
  answers: { id: string; content: string }[];
}

/**
 * Motif d'un refus de caviardage, sans aucun contenu : des types de données et
 * des comptes, jamais une valeur restée en clair.
 */
export interface PseudonymizationRefusal {
  kind: ReportPseudonymizationRefusalKind;
  /** Données restées en clair, par type : sur un refus de la garde. */
  violationCounts?: Partial<Record<PiiType, number>>;
  /** Statut HTTP du rejet : sur un refus du fournisseur, s'il est connu. */
  providerStatus?: number;
}
