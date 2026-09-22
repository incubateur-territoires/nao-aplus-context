"use client";

import Alert from "@codegouvfr/react-dsfr/Alert";
import { useContactFeedback } from "../contact-feedback-provider/contact-feedback-provider";
import { useFocusOnVisible } from "@/app/hooks/use-focus-on-visible";

export function ContactSuccessAlert() {
  const { isSent, setIsSent } = useContactFeedback();
  // Move focus (and scroll) to the confirmation when it appears, like every
  // other dynamic Alert in the app. The wrapper must carry `tabIndex={-1}`.
  const ref = useFocusOnVisible<HTMLDivElement>(isSent);

  if (!isSent) return null;

  return (
    <div ref={ref} tabIndex={-1}>
      <Alert
        severity="success"
        role="status"
        title="Votre message a bien été envoyé."
        description="Notre équipe de support répond généralement sous 1 à 2 jours ouvrés."
        closable
        onClose={() => setIsSent(false)}
        className="fr-mb-4w"
      />
    </div>
  );
}
