import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Setup2faContent } from "./components/setup-2fa-content";

export const metadata = {
  title: "Configurer la double authentification",
};

export default function ConfigurerTwoFactor() {
  return (
    <div className="fr-container fr-my-4w">
      <StartDsfrOnHydration />
      <div className="fr-grid-row fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-6">
          <h1>Configurer la vérification en deux étapes</h1>
          <p className="fr-text--lg">
            En tant qu&apos;administrateur, la vérification en deux étapes est
            obligatoire pour sécuriser votre compte.
          </p>
          <Setup2faContent />
        </div>
      </div>
    </div>
  );
}
