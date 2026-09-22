import { StartDsfrOnHydration } from "../../../dsfr-bootstrap";
import { Suspense } from "react";
import { VerifyTotpForm } from "./components/verify-totp-form";

export const metadata = {
  title: "Vérification double authentification",
};

export default function VerificationTwoFactor() {
  return (
    <div>
      <StartDsfrOnHydration />
      <Suspense fallback={<div role="status">Chargement...</div>}>
        <div className="fr-container fr-my-4w">
          <div className="fr-grid-row fr-grid-row--center">
            <div className="fr-col-12 fr-col-md-6">
              <h1>Vérification en deux étapes</h1>
              <p className="fr-text--lg">
                Veuillez saisir le code généré par votre application
                d&apos;authentification.
              </p>
              <VerifyTotpForm />
            </div>
          </div>
        </div>
      </Suspense>
    </div>
  );
}
