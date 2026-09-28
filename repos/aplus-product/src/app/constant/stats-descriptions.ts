/**
 * Phrases de définition affichées sous les titres de la page /statistiques.
 * Partagées entre les cartes et le tableau par équipe pour que « prise en
 * charge » veuille dire la même chose partout.
 */
export const TAKEN_IN_CHARGE_DESCRIPTION =
  "Un signalement est pris en charge au premier geste de l'opérateur : passage en « En cours de traitement » ou directement en « Traité ». Les signalements fermés par l'aidant sans réponse ne sont pas comptés.";

export const TREATMENT_DESCRIPTION =
  "Un signalement est traité quand il passe au statut « Traité ». C'est une mesure distincte de la prise en charge, qui est le premier geste de l'opérateur : un signalement pris en charge en un jour peut être traité dix jours plus tard. Les signalements fermés sans avoir été traités ne sont pas comptés.";

export const OPERATORS_DESCRIPTION =
  "Un signalement adressé à plusieurs opérateurs compte une fois pour chacun. Le total est un nombre de sollicitations, pas de signalements.";
