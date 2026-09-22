"use client";

import Stepper from "@codegouvfr/react-dsfr/Stepper";
import { useSearchParams } from "next/navigation";

export function RequestFormStepper() {
  const searchParams = useSearchParams();
  const step = searchParams.get("step");

  const currentStep = (step ? parseInt(step) : 1) as keyof typeof stepTitles;

  return (
    <Stepper
      currentStep={currentStep}
      stepCount={Object.keys(stepTitles).length}
      title={stepTitles[currentStep]}
    />
  );
}

const stepTitles = {
  1: "Destinataires du signalement ",
  2: "Informations du citoyen",
  3: "Signalement détaillé",
  4: "Récapitulatif et validation",
};
