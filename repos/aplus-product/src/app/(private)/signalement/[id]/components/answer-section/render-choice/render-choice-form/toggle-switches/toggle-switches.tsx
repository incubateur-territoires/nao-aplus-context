import { ToggleSwitch } from "@codegouvfr/react-dsfr/ToggleSwitch";
import { Control, Controller, useWatch } from "react-hook-form";
import { FormValues } from "../types";
import Alert from "@codegouvfr/react-dsfr/Alert";

interface ToggleSwitchesProps {
  control: Control<FormValues>;
  showInstructorOnly?: boolean;
  showIsIrrelevant?: boolean;
}

export function ToggleSwitches({
  control,
  showInstructorOnly,
  showIsIrrelevant,
}: ToggleSwitchesProps) {
  const isOperatorOnlyChecked = useWatch({ control, name: "isOperatorOnly" });

  return (
    <>
      <Controller
        control={control}
        name="isOperatorOnly"
        render={({ field }) => (
          <ToggleSwitch
            className={`mt-8 ${showInstructorOnly ? "block" : "hidden"}`}
            label="Cacher ce message aux auteurs et aux co-auteurs afin que seuls les opérateurs puissent le lire"
            inputTitle="terms"
            showCheckedHint={false}
            checked={field.value}
            onChange={field.onChange}
          />
        )}
      />
      {isOperatorOnlyChecked ? (
        <Alert
          className="mt-4"
          severity="warning"
          title=""
          description="La personne qui a créé le signalement (l’auteur) ne pourra pas lire ce message. Les membres de son équipe (les co-auteurs) ne pourront pas lire ce message. Seuls les opérateurs destinataires pourront le lire."
        />
      ) : null}

      <Controller
        control={control}
        name="isIrrelevant"
        render={({ field }) => (
          <ToggleSwitch
            className={`mt-8 ${showIsIrrelevant ? "block" : "hidden"}`}
            helperText="Le signalement sera classé comme 'Non pertinent' dans les statistiques d'usage."
            label="Ce signalement dispose d'une procédure standard que l'aidant aurait pu utiliser"
            inputTitle="terms"
            showCheckedHint={false}
            checked={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </>
  );
}
