import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import Link from "next/link";
import { ROUTE } from "@/app/constant/route";

export const metadata = {
  title: "Accessibilité",
};

export default async function Accessibilite() {
  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Déclaration d'accessibilité"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <div className="gap-4 my-6 ">
            <h1>Déclaration d&apos;accessibilité</h1>
            <div className="p-4 md:p-20 bg-white mt-8 relative">
              <p>Établie le 2 juillet 2026.</p>
              <p>
                L&apos;agence nationale de la cohésion des territoires
                s&apos;engage à rendre son service accessible, conformément à
                l&apos;article 47 de la loi n° 2005-102 du 11 février 2005.
              </p>
              <p>
                À cette fin, Administration+ s&apos;inscrit dans le{" "}
                <Link
                  href="https://docs.numerique.gouv.fr/docs/b8f7f83e-56cd-489f-a474-55ec325a2ba6/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  schéma pluriannuel d&apos;accessibilité de l&apos;Incubateur
                  des territoires
                  <span className="sr-only"> - nouvelle fenêtre</span>
                </Link>
                .
              </p>
              <p>
                Cette déclaration d&apos;accessibilité s&apos;applique à{" "}
                <strong>Administration+</strong> (
                <Link
                  href="https://aplus.beta.gouv.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://aplus.beta.gouv.fr
                  <span className="sr-only"> - nouvelle fenêtre</span>
                </Link>
                ).
              </p>

              <h2 className="fr-mt-4w">État de conformité</h2>
              <p>
                <strong>Administration+</strong> est{" "}
                <strong>totalement conforme</strong> avec le référentiel général
                d&apos;amélioration de l&apos;accessibilité (RGAA).
              </p>

              <h2 className="fr-mt-4w">Résultats des tests</h2>
              <p>
                L&apos;audit de conformité réalisé en juin 2026 par Arya Access
                révèle que 100 % des critères du RGAA version 4.1.2 sont
                respectés sur l&apos;échantillon du site audité.
              </p>
              <p>
                <Link
                  href="https://ara.numerique.gouv.fr/rapport/awFvxBc64s9wvBdhgHTCK/resultats"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Consulter le rapport d&apos;audit d&apos;accessibilité
                  <span className="sr-only"> - nouvelle fenêtre</span>
                </Link>
              </p>

              <h3 className="fr-mt-3w">
                Pages ayant fait l&apos;objet de la vérification de conformité
              </h3>
              <ul>
                <li>Accueil</li>
                <li>Plan du site</li>
                <li>Contact</li>
                <li>Authentification</li>
                <li>Tous les signalements</li>
                <li>Signalement</li>
                <li>Créer un signalement</li>
                <li>Équipes</li>
                <li>Équipe</li>
                <li>Créer une équipe</li>
                <li>Utilisateurs</li>
              </ul>

              <h2 className="fr-mt-4w">
                Établissement de cette déclaration d&apos;accessibilité
              </h2>
              <p>Cette déclaration a été établie le 2 juillet 2026.</p>

              <h3 className="fr-mt-3w">Technologies utilisées</h3>
              <p>
                L&apos;accessibilité d&apos;Administration+ s&apos;appuie sur
                les technologies suivantes :
              </p>
              <ul>
                <li>HTML</li>
                <li>WAI-ARIA</li>
                <li>CSS</li>
                <li>TypeScript</li>
                <li>React 19</li>
                <li>Next.js 16</li>
                <li>Système de design de l&apos;État (DSFR)</li>
                <li>Tailwind CSS</li>
                <li>MUI (Material UI)</li>
              </ul>

              <h3 className="fr-mt-3w">Environnement de test</h3>
              <p>
                Les vérifications de restitution de contenus ont été réalisées
                sur les combinaisons suivantes :
              </p>
              <ul>
                <li>NVDA 2025 et Firefox 141</li>
                <li>Jaws 2024 et Firefox 141</li>
                <li>VoiceOver et Safari</li>
              </ul>

              <h2 className="fr-mt-4w">Amélioration et contact</h2>
              <p>
                Si vous n&apos;arrivez pas à accéder à un contenu ou à un
                service, vous pouvez contacter le responsable
                d&apos;Administration+ pour être orienté vers une alternative
                accessible ou obtenir le contenu sous une autre forme.
              </p>
              <ul>
                <li>
                  E-mail :{" "}
                  <Link href="mailto:support@aplus.beta.gouv.fr">
                    support@aplus.beta.gouv.fr
                  </Link>
                </li>
                <li>Adresse : ANCT, Ségur, Paris</li>
              </ul>
              <p>Nous essayons de répondre dans les 5 jours ouvrés.</p>

              <h2 className="fr-mt-4w">Voie de recours</h2>
              <p>
                Cette procédure est à utiliser dans le cas suivant : vous avez
                signalé au responsable du site internet un défaut
                d&apos;accessibilité qui vous empêche d&apos;accéder à un
                contenu ou à un des services du portail et vous n&apos;avez pas
                obtenu de réponse satisfaisante.
              </p>
              <p>Vous pouvez :</p>
              <ul>
                <li>
                  <Link
                    href="https://formulaire.defenseurdesdroits.fr/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Écrire un message au Défenseur des droits
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://www.defenseurdesdroits.fr/saisir/delegues"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Contacter le délégué du Défenseur des droits dans votre
                    région
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>
                </li>
                <li>
                  Envoyer un courrier par la poste (gratuit, ne pas mettre de
                  timbre) :
                  <br />
                  Défenseur des droits
                  <br />
                  Libre réponse 71120 75342 Paris CEDEX 07
                </li>
              </ul>

              <hr className="fr-mt-4w" />
              <p className="fr-mt-2w">
                Cette déclaration d&apos;accessibilité a été créée le 2 juillet
                2026 en s&apos;appuyant sur le{" "}
                <Link
                  href="https://betagouv.github.io/a11y-generateur-declaration/#create"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Générateur de déclaration d&apos;accessibilité de BetaGouv
                  <span className="sr-only"> - nouvelle fenêtre</span>
                </Link>
                .
              </p>
            </div>
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
