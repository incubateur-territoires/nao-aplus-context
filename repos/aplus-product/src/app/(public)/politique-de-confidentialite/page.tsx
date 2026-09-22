import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import Link from "next/link";
import { ROUTE } from "@/app/constant/route";

export const metadata = {
  title: "Politique de confidentialité",
};

export default async function DonneesPersonnelles() {
  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Politique de confidentialité"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <div className="gap-4 my-6 ">
            <h1>Politique de confidentialité</h1>
            <div className="p-4 md:p-20 bg-white mt-8 relative">
              <p className="fr-text--lg fr-text--bold">
                Dernière mise à jour le 09/03/2026
              </p>

              <h2 className="fr-mt-4w">Qui sommes-nous ?</h2>
              <p>
                Administration+ est un service public numérique développé au
                sein de l&apos;Incubateur des territoires de l&apos;Agence
                Nationale de la Cohésion des Territoires (ANCT) et financé
                notamment par le programme France services de l&apos;ANCT.
              </p>
              <p>
                Il s&apos;agit d&apos;une plateforme qui met en relation des
                aidants professionnels avec des agents d&apos;organisations
                ayant une mission de service public pour régler rapidement des
                blocages administratifs complexes et urgents des usagers.
              </p>
              <p>
                Le responsable de traitement est l&apos;ANCT, représentée par
                son Directeur général.
              </p>

              <h2 className="fr-mt-4w">
                Pourquoi traitons-nous des données à caractère personnel ?
              </h2>
              <p>
                Administration+ traite des données à caractère personnel pour
                proposer une messagerie sécurisée dans le but de mettre en
                relation des aidants mandatés par les usagers avec des
                opérateurs concernés par le signalement de l&apos;usager et
                indispensables pour résoudre le problème. Les données sont
                traitées pour identifier les opérateurs mandatés et les usagers
                concernés et diffuser la lettre d&apos;information.
              </p>

              <h2 className="fr-mt-4w">
                Quelles sont les données à caractère personnel que nous traitons
                ?
              </h2>
              <ul>
                <li>
                  <strong>Données relatives à l&apos;utilisateur</strong> : nom,
                  prénom, numéro de téléphone, adresse e-mail, messages échangés
                  ;
                </li>
                <li>
                  <strong>Données relatives à l&apos;usager</strong> : nom,
                  prénom, adresse e-mail, numéro de téléphone, adresse postale,
                  date de naissance, champs libres, messages échangés, pièces
                  jointes, données identifiantes (cf. CGU) ;
                </li>
                <li>
                  <strong>Données relatives à la traçabilité</strong> : logs et
                  adresse IP ;
                </li>
                <li>
                  <strong>
                    Données relatives à la lettre d&apos;information
                  </strong>{" "}
                  : nom, prénom, adresse e-mail.
                </li>
              </ul>

              <h2 className="fr-mt-4w">
                Qu&apos;est-ce qui nous autorise à traiter des données à
                caractère personnel ?
              </h2>
              <p>
                Le traitement est nécessaire à l&apos;exécution d&apos;une
                mission d&apos;intérêt public ou relevant de l&apos;exercice de
                l&apos;autorité publique dont est investie l&apos;ANCT en tant
                que responsable de traitement vis à vis des données relatives
                aux utilisateurs de la plateforme, au sens de l&apos;article 6-1
                e) du RGPD.
              </p>
              <p>
                Cette mission d&apos;intérêt public se traduit en pratique
                notamment par l&apos;article L. 1231-2 du code général des
                collectivités territoriales (CGCT).
              </p>

              <h2 className="fr-mt-4w">
                Pendant combien de temps conservons-nous vos données ?
              </h2>
              <div className="fr-table fr-mt-3w">
                <table>
                  <thead>
                    <tr>
                      <th>Catégories de données</th>
                      <th>Durée de conservation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Données relatives aux utilisateurs</td>
                      <td>2 ans à partir du dernier contact</td>
                    </tr>
                    <tr>
                      <td>Données relatives à l&apos;usager</td>
                      <td>6 mois à partir du dernier contact</td>
                    </tr>
                    <tr>
                      <td>Données relatives à la traçabilité</td>
                      <td>1 an conformément à la LCEN</td>
                    </tr>
                    <tr>
                      <td>Données relatives à la lettre d&apos;information</td>
                      <td>
                        Jusqu&apos;à la désinscription de l&apos;utilisateur
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 className="fr-mt-4w">Quels sont vos droits ?</h2>
              <p>Vous disposez :</p>
              <ul>
                <li>
                  D&apos;un droit d&apos;information et d&apos;accès à vos
                  données ;
                </li>
                <li>D&apos;un droit de rectification ;</li>
                <li>D&apos;un droit d&apos;opposition ;</li>
                <li>D&apos;un droit à la limitation du traitement.</li>
              </ul>
              <p>
                Pour exercer vos droits, vous pouvez nous contacter à :{" "}
                <Link href="mailto:contact@aplus.beta.gouv.fr">
                  contact@aplus.beta.gouv.fr
                </Link>
              </p>
              <p>
                Ou contacter la déléguée à la protection des données à :{" "}
                <Link href="mailto:dpo@anct.gouv.fr">dpo@anct.gouv.fr</Link>
              </p>
              <p>
                Puisque ce sont des droits personnels, nous ne traiterons votre
                demande que si nous sommes en mesure de vous identifier. Dans le
                cas contraire, nous pouvons être amenés à vous demander une
                preuve de votre identité.
              </p>
              <p>
                Nous nous engageons à répondre à votre demande dans un délai
                raisonnable qui ne saurait excéder 1 mois à compter de la
                réception de votre demande.
              </p>
              <p>
                Si vous estimez que vos droits n&apos;ont pas été respectés
                après nous avoir contactés, vous pouvez adresser une réclamation
                à la CNIL.
              </p>

              <h2 className="fr-mt-4w">Qui peut avoir accès à vos données ?</h2>
              <p>
                Les personnes suivantes ont accès à vos données en tant que
                destinataires :
              </p>
              <ul>
                <li>
                  Les membres habilités de l&apos;équipe d&apos;Administration+
                  (administrateurs, développeurs notamment) ont accès à vos
                  données, dans le cadre de leurs missions ;
                </li>
                <li>
                  Les organismes publics et privés ayant un rôle d&apos;aidant
                  professionnel : Établissements France Services, CCAS ;
                </li>
                <li>
                  Les organismes publics et privés ayant un rôle
                  d&apos;opérateur de service public : CNAV, CNAM, CAF, CDAD,
                  CRAMIF, Assurance Maladie, MSA, ministère des Finances, France
                  Travail, URSSAF, ministère de l&apos;Intérieur (préfectures).
                </li>
              </ul>

              <h2 className="fr-mt-4w">
                Qui nous aide à traiter vos données ?
              </h2>
              <p>
                Certaines données sont communiquées à des « sous-traitants » qui
                agissent pour le compte de l&apos;ANCT, selon ses instructions.
              </p>
              <p>
                <strong>Liste des sous-traitants :</strong>
              </p>
              <div className="fr-table fr-mt-3w">
                <table>
                  <thead>
                    <tr>
                      <th>Sous-traitant</th>
                      <th>Traitement réalisé</th>
                      <th>Pays destinataire</th>
                      <th>Garanties</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Scalingo</td>
                      <td>Hébergement</td>
                      <td>France</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td>Brevo</td>
                      <td>Gestion de la lettre d&apos;information</td>
                      <td>France</td>
                      <td>
                        <Link
                          href="https://www.brevo.com/legal/termsofuse/#data-processing-agreement-dpa"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          DPA Brevo
                          <span className="sr-only"> - nouvelle fenêtre</span>
                        </Link>
                      </td>
                    </tr>
                    <tr>
                      <td>Zammad</td>
                      <td>Gestion du support</td>
                      <td>Allemagne</td>
                      <td>
                        <Link
                          href="https://zammad.com/en/company/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Politique de confidentialité Zammad
                          <span className="sr-only"> - nouvelle fenêtre</span>
                        </Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 className="fr-mt-4w">Cookies et traceurs</h2>
              <p>
                Un cookie est un fichier déposé sur votre terminal lors de la
                visite d&apos;un site. Il a pour but de collecter des
                informations relatives à votre navigation et de vous adresser
                des services adaptés à votre terminal (ordinateur, mobile ou
                tablette).
              </p>
              <p>
                En application de l&apos;article 5-3 de la directive ePrivacy,
                transposée à l&apos;article 82 de la loi n° 78-17 du 6 janvier
                1978 relative à l&apos;informatique, aux fichiers et aux
                libertés, les cookies et traceurs suivent deux régimes
                distincts.
              </p>
              <p>
                D&apos;une part, les cookies strictement nécessaires au service
                ou ayant pour finalité exclusive de faciliter la communication
                par voie électronique, sont dispensés de consentement.
              </p>
              <p>
                D&apos;autre part, les cookies n&apos;étant pas strictement
                nécessaires au service ou n&apos;ayant pas pour finalité
                exclusive de faciliter la communication par voie électronique,
                doivent être consentis par l&apos;utilisateur.
              </p>
              <p>
                Ce consentement de la personne concernée constitue une base
                légale au sens du RGPD, à savoir l&apos;article 6-1 a).
                Administration+ ne dépose aucun cookie tiers sur sa plateforme
                et ne nécessite aucun consentement.
              </p>

              <h3 className="fr-mt-3w">
                Pour en savoir plus sur les cookies :
              </h3>
              <ul>
                <li>
                  <Link
                    href="https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Cookies et traceurs : que dit la loi ?
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://www.cnil.fr/fr/cookies-et-autres-traceurs/comment-se-proteger/maitriser-votre-navigateur"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Cookies : les outils pour les maîtriser
                    <span className="sr-only"> - nouvelle fenêtre</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
