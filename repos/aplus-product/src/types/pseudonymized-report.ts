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
