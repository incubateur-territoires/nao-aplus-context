interface NamedArea {
  id: string;
  name: string;
}

/**
 * Le territoire d'un signalement est celui de l'équipe autrice, pas un choix de
 * l'aidant. Équipe à plusieurs territoires : le premier par ordre alphabétique
 * (décision produit), pour que serveur et récapitulatif affichent le même.
 */
export function getReportAreaFromApplicantTeam<T extends NamedArea>(
  teamAreas: T[],
): T | undefined {
  return [...teamAreas].sort((a, b) => a.name.localeCompare(b.name, "fr"))[0];
}
