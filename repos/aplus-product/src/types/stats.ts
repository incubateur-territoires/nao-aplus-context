/**
 * En-têtes des deux colonnes d'une série de statistiques, propres à chaque
 * bloc : « Date » / « Nombre de signalements » pour les signalements par mois,
 * « État » / « Nombre de signalements » pour la répartition par état, etc.
 *
 * Partagés par la vue tableau d'une carte et son export XLSX, pour que les deux
 * nomment les colonnes de la même façon.
 */
export interface StatsColumnHeaders {
  /** Colonne des libellés (l'axe de la série) : « Date », « État »… */
  label: string;
  /** Colonne des valeurs : « Nombre de signalements »… */
  value: string;
}
