/**
 * Bornes des filtres de la page Statistiques, partagées entre la validation
 * d'entrée du routeur (`stats`) et l'analyse de l'URL (`stats-filters-url`).
 *
 * Les deux doivent s'accorder : ce que l'URL laisse passer, le routeur doit
 * l'accepter — sinon un lien forgé produirait une page en erreur plutôt qu'une
 * dégradation propre vers des statistiques non filtrées.
 */

/** Un id (cuid) fait ~25 caractères ; au-delà de 50, ce n'en est pas un. */
export const MAX_ID_LENGTH = 50;

/**
 * Couvre largement le cas réel le plus lourd (~2 500 équipes) tout en évitant
 * qu'une liste arbitrairement longue se traduise par cinq requêtes de facettes
 * en parallèle sur un `= ANY` géant.
 */
export const MAX_SELECTED_IDS = 5000;
