"use client";

import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Container } from "@/app/component/container/container";

const SUPPORT_URL = "https://docs.aplus.beta.gouv.fr/contacter-lequipe";

export function NoTeamAlert() {
  return (
    <Container className="mt-8">
      <div className="bg-white p-8 md:p-20">
        <Alert
          severity="warning"
          title="Utilisateur retiré de l’équipe"
          description={
            <>
              <p>
                Votre compte n’est actuellement rattaché à aucune équipe sur
                Administration+. Vous ne pouvez ni créer de signalement ni
                répondre à des signalements.
                <br />
                Contactez la personne qui a créé votre compte Administration+ et
                demandez-lui d’ajouter votre compte à son équipe.
              </p>
              <p className="fr-mt-3w">
                En cas de souci,{" "}
                <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                  contactez notre support
                </a>
                .
              </p>
            </>
          }
        />
      </div>
    </Container>
  );
}
