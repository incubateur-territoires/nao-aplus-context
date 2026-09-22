import { ActionChoiceValue } from "../../action-choice/action-choice";

/**
 * Get the label for a given action choice
 */
export function getActionChoiceLabel(choice: ActionChoiceValue): string {
  const labels: Record<ActionChoiceValue, string> = {
    [ActionChoiceValue.SEND_MESSAGE]: "Ajouter un message ou un fichier",
    [ActionChoiceValue.IN_TREATMENT]: "Prendre en charge le signalement",
    [ActionChoiceValue.COMPLETED]: "Marquer le signalement comme traité",
    [ActionChoiceValue.INVITE]: "Inviter d'autres utilisateurs",
  };
  return labels[choice];
}

/**
 * Get default message text based on the selected action choice
 */
export function getDefaultMessage(choice: ActionChoiceValue | null): string {
  if (!choice) return "";

  const messages: Partial<Record<ActionChoiceValue, string>> = {
    [ActionChoiceValue.IN_TREATMENT]:
      "Bonjour,\nJe m'occupe de ce signalement.\nCordialement,",
    [ActionChoiceValue.COMPLETED]:
      "Bonjour,\nJ'ai fait le nécessaire.\nJe vous invite à fermer le signalement.\nCordialement,",
    [ActionChoiceValue.SEND_MESSAGE]: "",
    [ActionChoiceValue.INVITE]: "",
  };

  return messages[choice] || "";
}

/**
 * Determine which toggle switches should be visible based on the selected action
 */
export function getToggleSwitchesVisibility(choice: ActionChoiceValue | null) {
  return {
    showInstructorOnly: choice === ActionChoiceValue.SEND_MESSAGE,
    showIsIrrelevant:
      choice === ActionChoiceValue.IN_TREATMENT ||
      choice === ActionChoiceValue.COMPLETED,
  };
}
