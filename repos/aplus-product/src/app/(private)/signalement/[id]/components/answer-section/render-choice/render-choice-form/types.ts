import { ActionChoiceValue } from "../../action-choice/action-choice";

export interface FormValues {
  message?: string;
  files: File[];
  isOperatorOnly: boolean;
  isIrrelevant: boolean;
  actionChoice: ActionChoiceValue | null;
}
