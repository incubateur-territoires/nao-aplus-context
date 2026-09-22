export const ACTION_CHOICE_OPTIONS = [
  {
    label: "Prendre en charge le signalement",
    hintText:
      "Le signalement passera au statut <strong>EN COURS DE TRAITEMENT</strong>",
    value: "IN_TREATMENT",
  },
  {
    label: "Marquer le signalement comme traité",
    hintText: "Le signalement passera au statut <strong>TRAITÉ</strong>",
    value: "COMPLETED",
  },
  {
    label: "Ajouter un message ou un fichier",
    hintText: "Le signalement conservera son statut actuel",
    value: "SEND_MESSAGE",
  },
] as const;
