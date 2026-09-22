import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";

export const metadata = {
  title: "Conditions générales d'utilisation",
};

export default async function ConditionsGenerales() {
  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Conditions Générales d'Utilisation"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <div className="gap-4 my-6 ">
            <h1>Conditions Générales d&apos;Utilisation</h1>
            <div className="p-4 md:p-20 bg-white mt-8 relative">
              <p className="fr-text--lg fr-text--bold">
                En vigueur à partir du 09/03/2026
              </p>

              <h2 className="fr-mt-4w">Article 1 - Champ d&apos;application</h2>
              <p>
                Les présentes conditions générales d&apos;utilisation (ci-après
                « CGU ») précisent le cadre juridique d&apos;Administration+
                (ci-après le « Produit numérique ») et définissent les
                conditions d&apos;accès et d&apos;utilisation des Services par
                l&apos;Utilisateur.
              </p>
              <p>
                L&apos;annexe relative à l&apos;accord sur le traitement des
                données, au sens de l&apos;article 28-3 du RGPD, fait partie
                intégrante des présentes CGU.
              </p>

              <h2 className="fr-mt-4w">
                Article 2 - Objet du Produit numérique
              </h2>
              <p>
                Administration+ est un produit numérique développé au sein de
                l&apos;Agence nationale de la cohésion des territoires (ANCT)
                dans le but de mettre en relation des aidants professionnels
                mandatés dans le cadre de leur fonction (ci-après « Aidant »)
                par des usagers avec des opérateurs habilités (ci-après «
                Opérateurs ») pour résoudre des blocages administratifs
                complexes et/ou urgents d&apos;usagers.
              </p>

              <h2 className="fr-mt-4w">Article 3 - Définitions</h2>
              <p>
                <strong>&quot;Organisation&quot;</strong> désigne un organisme
                chargé d&apos;une mission de service public administratif
                conformément à l&apos;article L. 100-3 du code des relations
                entre le public et l&apos;administration (CRPA) qui emploie des
                Aidants et Opérateurs.
              </p>
              <p>
                <strong>&quot;Administrateur&quot;</strong> désigne
                l&apos;utilisateur qui dispose des droits les plus élevés.
                L&apos;administrateur gère notamment l&apos;ensemble des équipes
                (par exemple : leur création) et des comptes utilisateurs (par
                exemple : modification de l&apos;adresse e-mail, changement de
                rôle aidant/instructeur). Actuellement, seuls les membres de
                l&apos;équipe Administration+ sont administrateurs.
              </p>
              <p>
                <strong>&quot;Aidant&quot;</strong> désigne toute personne
                physique, habilitée par son Administration qui a conclu un
                mandat écrit généré par le Produit numérique avec l&apos;usager
                accompagné (par le biais de son Organisation ou via le Produit
                numérique) et qualifie/reformule ses signalements auprès de
                l&apos;Opérateur.
              </p>
              <p>
                <strong>&quot;Éditeur&quot;</strong> désigne la personne morale
                qui met à la disposition du public le Produit numérique, à
                savoir l&apos;ANCT.
              </p>
              <p>
                <strong>&quot;Opérateur&quot;</strong> désigne toute personne
                physique habilitée par son Administration et mandatée par écrit
                par un Aidant pour débloquer rapidement une situation
                administrative complexe et/ou urgente.
              </p>
              <p>
                <strong>&quot;Produit numérique&quot;</strong> désigne le
                service numérique qui permet aux agents publics de résoudre les
                problématiques administratives complexes et/ou urgentes des
                usagers.
              </p>
              <p>
                <strong>&quot;Responsable d&apos;équipe&quot;</strong> désigne
                toute personne physique habilitée par son Organisation chargée
                de gérer l&apos;utilisation du Produit numérique dans son ou ses
                établissements et sur son territoire.
              </p>
              <p>
                <strong>&quot;Superviseur&quot;</strong> désigne toute personne
                physique habilitée par son organisation pour piloter
                l&apos;activité ou faciliter l&apos;organisation et
                l&apos;utilisation du Produit numérique dans son organisation et
                sur son / ses territoires.
              </p>
              <p>
                <strong>&quot;Services&quot;</strong> désigne les
                fonctionnalités proposées par le Produit numérique pour répondre
                à ses finalités.
              </p>
              <p>
                <strong>&quot;Utilisateur&quot;</strong> désigne toute personne
                physique habilitée, qui s&apos;inscrit sur le Produit numérique.
              </p>

              <h2 className="fr-mt-4w">Article 4 - Fonctionnalités</h2>

              <h3 className="fr-mt-3w">
                4.1 Inscription sur le Produit numérique
              </h3>
              <p>
                L&apos;Organisation désigne un Responsable d&apos;équipe
                primaire ou Superviseur dont elle communique le nom et les
                coordonnées à l&apos;Administrateur du produit. Sur cette base,
                l&apos;administrateur crée un compte pour ce Responsable
                d&apos;équipe primaire. C&apos;est ensuite au Responsable
                d&apos;équipe primaire, une fois son compte créé, de créer les
                comptes des membres de son équipe, c&apos;est-à-dire des
                utilisateurs de son organisation. Il peut également désigner des
                Responsables d&apos;équipe qui eux-mêmes pourront créer des
                comptes d&apos;Utilisateur pour leur équipe.
              </p>
              <p>
                Les responsables, primaire ou non, auront également la
                responsabilité de supprimer les comptes de leur équipe.
              </p>

              <h3 className="fr-mt-3w">
                4.2 Connexion au compte sur le Produit numérique
              </h3>
              <p>
                Pour se connecter à son compte, l&apos;Utilisateur renseigne son
                adresse courriel professionnelle ainsi qu&apos;un mot de passe
                sur le Produit numérique.
              </p>

              <h3 className="fr-mt-3w">4.3 Rôles de l&apos;Utilisateur</h3>
              <p>L&apos;Utilisateur est soit :</p>
              <ul>
                <li>
                  <strong>Un Aidant</strong> qui est en contact direct avec les
                  usagers, pour qualifier et reformuler les signalements avant
                  de les transmettre aux Opérateurs, là où leur intervention
                  peut permettre une résolution. L&apos;Aidant a, au préalable,
                  conclu un mandat écrit avec l&apos;usager généré par le
                  Produit numérique ;
                </li>
                <li>
                  <strong>Un Opérateur</strong> qui soit a été saisi par un
                  Aidant pour répondre à un problème administratif urgent et/ou
                  complexe, ou soit qui invite ou est invité par un autre
                  Opérateur sur un signalement. Les instructeurs apportent une
                  réponse directe aux usagers à travers les canaux de
                  communication personnalisés qu&apos;ils utilisent
                  d&apos;ordinaire. Ils peuvent également apporter une réponse à
                  l&apos;Aidant si nécessaire ;
                </li>
                <li>
                  <strong>Un Responsable d&apos;équipe primaire</strong> désigné
                  par son Organisation qui est le premier responsable d&apos;une
                  équipe. Ce responsable peut nommer d&apos;autres responsables
                  au sein de son équipe, créer des comptes et retirer des
                  comptes de l&apos;équipe.
                </li>
                <li>
                  <strong>Un Responsable d&apos;équipe</strong> qui gère
                  également l&apos;utilisation du Produit numérique au sein de
                  son Organisation (création et désactivation des comptes
                  utilisateurs, création d&apos;équipes).
                </li>
                <li>
                  <strong>Un Superviseur</strong> désigné par son organisation,
                  qui peut créer et gérer des équipes sur un ou plusieurs
                  territoires, et créer ou désactiver des comptes utilisateurs
                  de son organisation. Par principe, il n&apos;a pas accès au
                  contenu des demandes.
                </li>
                <li>
                  <strong>Un Administrateur</strong> qui s&apos;assure du bon
                  fonctionnement du Produit numérique, assiste les Utilisateurs
                  en cas de problématique technique ou fonctionnelle et atteste
                  de la parfaite mise en relation entre l&apos;Aidant et
                  l&apos;Opérateur. Par principe, il n&apos;a pas accès au
                  contenu des demandes.
                </li>
              </ul>

              <div className="fr-table fr-mt-3w">
                <table>
                  <thead>
                    <tr>
                      <th>Étape</th>
                      <th>Acteurs concernés</th>
                      <th>Accès aux données</th>
                      <th>Durée</th>
                      <th>Commentaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Phase 1 : Ouverture</td>
                      <td>Aidant, Opérateur</td>
                      <td>
                        Accès complet aux données et fichiers en pièce jointe
                      </td>
                      <td>Jusqu&apos;à fermeture</td>
                      <td>Phase active de traitement du signalement</td>
                    </tr>
                    <tr>
                      <td>Phase 2 : Fermeture du signalement</td>
                      <td>Aidant, Opérateur</td>
                      <td>Accès complet aux données (sans pièces jointes)</td>
                      <td>6 mois après la fermeture du signalement</td>
                      <td>
                        L&apos;aidant ferme la demande, un délai de 6 mois
                        s&apos;ouvre
                      </td>
                    </tr>
                    <tr>
                      <td>Phase 3 : Anonymisation des données citoyens</td>
                      <td>Administrateurs uniquement</td>
                      <td>
                        Accès aux métadonnées uniquement (suppression des
                        données personnelles des citoyens)
                      </td>
                      <td>
                        2 mois après suppression des données du signalement
                      </td>
                      <td>
                        Période technique en cas de problème technique sur la
                        Plateforme pour un usage statistique
                      </td>
                    </tr>
                    <tr>
                      <td>Phase 4 : Suppression définitive</td>
                      <td>Tous les utilisateurs</td>
                      <td>Toutes les données sont supprimées définitivement</td>
                      <td>Définitif</td>
                      <td>Pas de retour en arrière possible</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="fr-mt-3w">
                4.4 Collecte de données hautement personnelles par certaines
                Organisations
              </h3>
              <p>
                Seules certaines Organisations habilitées, eu égard à leurs
                missions et compétences peuvent renseigner certaines
                informations notamment le numéro fiscal de référence,
                l&apos;identifiant Caisse d&apos;Allocation Familiale (CAF) et
                Mutuelle Sociale Agricole (MSA) sur le Produit numérique. Les
                champs permettant de les renseigner ne sont visibles que pour
                ces Organisations habilitées.
              </p>
              <p>
                Les Administrations mentionnées par le décret n° 2019-341 du 19
                avril 2019 peuvent renseigner le numéro d&apos;inscription au
                répertoire national d&apos;identification des personnes
                physiques.
              </p>
              <p>
                Dans ce cadre, l&apos;ANCT agit en qualité de sous-traitant,
                conformément au RGPD et à l&apos;accord sur le traitement des
                données en annexe des présentes CGU.
              </p>

              <h2 className="fr-mt-4w">Article 5 - Responsabilités</h2>

              <h3 className="fr-mt-3w">
                5.1 L&apos;Éditeur du Produit numérique
              </h3>
              <p>
                Les sources des informations diffusées sur le Produit numérique
                sont réputées fiables mais l&apos;Éditeur ne garantit pas
                qu&apos;elle soit exempte de défauts, d&apos;erreurs ou
                d&apos;omissions.
              </p>
              <p>
                L&apos;Éditeur s&apos;engage à la sécurisation du Produit
                numérique, notamment en prenant toutes les mesures nécessaires
                permettant de garantir la sécurité et la confidentialité des
                informations fournies. Il ne saurait être tenu responsable de
                tout contenu publié par l&apos;Utilisateur sur le Produit
                numérique, notamment des fausses informations renseignées par ce
                dernier.
              </p>
              <p>
                L&apos;Éditeur fournit les moyens nécessaires et raisonnables
                pour assurer un accès continu au Produit numérique. Il se
                réserve le droit de faire évoluer, de modifier ou de suspendre,
                sans préavis, le Produit numérique pour tout motif jugé
                nécessaire.
              </p>
              <p>
                En aucun cas, l&apos;Éditeur n&apos;est responsable de
                l&apos;habilitation d&apos;un Utilisateur, celle-ci relève
                uniquement de la responsabilité de l&apos;Organisation dont il
                fait partie.
              </p>
              <p>
                En cas de manquement à une ou plusieurs des stipulations des
                présentes CGU, l&apos;Éditeur se réserve le droit de suspendre
                ou de supprimer le compte de l&apos;Utilisateur responsable.
              </p>

              <h3 className="fr-mt-3w">5.2 L&apos;Utilisateur</h3>
              <p>
                L&apos;Utilisateur s&apos;assure de garder son lien de
                connexion, son identifiant et mot de passe secrets. Toute
                divulgation du lien, quelle que soit sa forme, est strictement
                interdite. Il assume les risques liés à l&apos;utilisation de
                son adresse courriel.
              </p>
              <p>
                Lors de la création d&apos;un compte sur le Produit Numérique,
                le Responsable d&apos;équipe s&apos;assure que la personne dont
                le compte est créé est bien habilitée par son Organisation à
                répondre aux signalements de blocage administratif par le biais
                du Produit numérique. Lors de la première connexion, ce nouvel
                utilisateur devra accepter les présentes CGU.
              </p>
              <p>
                Toute information transmise par l&apos;Utilisateur est de sa
                seule responsabilité. Il est rappelé que toute personne
                procédant à une fausse déclaration pour elle-même ou pour autrui
                s&apos;expose notamment aux sanctions prévues à l&apos;article
                441-1 du code pénal, prévoyant des peines pouvant aller
                jusqu&apos;à trois ans d&apos;emprisonnement et 45 000 euros
                d&apos;amende.
              </p>
              <p>
                L&apos;Utilisateur s&apos;engage formellement par les présentes
                CGU à ne pas mettre en ligne de contenus ou informations
                contraires aux dispositions légales et réglementaires en
                vigueur. Il veille également à ne pas communiquer de données
                sensibles ou de secrets protégés par la loi, et à ne pas publier
                de contenus illicites notamment dans les zones de champs libres.
              </p>
              <p>
                L&apos;Aidant certifie avoir recueilli l&apos;autorisation de
                l&apos;usager pour le traitement de son signalement par un
                Opérateur sur le Produit numérique. Il s&apos;engage également à
                clôturer le signalement lorsque l&apos;Opérateur indique
                qu&apos;elle est résolue.
              </p>
              <p>
                Le Responsable d&apos;équipe s&apos;engage à désactiver les
                comptes des utilisateurs qui ne sont plus en fonction. Si un
                compte Utilisateur est inactif pendant plus de 6 mois, son
                compte sera désactivé par l&apos;Administrateur et le
                Responsable d&apos;équipe devra contacter l&apos;Administrateur
                pour le faire réactiver.
              </p>

              <h2 className="fr-mt-4w">Article 6 - Mise à jour des CGU</h2>
              <p>
                Les termes des présentes CGU peuvent être amendés à tout moment,
                en fonction des modifications apportées au Produit numérique, de
                l&apos;évolution de la législation ou pour tout autre motif jugé
                nécessaire.
              </p>
              <p>
                Chaque modification donne lieu à une nouvelle version qui doit
                être acceptée par l&apos;Utilisateur selon les modalités prévues
                par le Produit numérique.
              </p>

              <h2 className="fr-mt-4w">
                Article 7 - Loi applicable et juridiction compétente
              </h2>
              <p>
                Les présentes CGU sont soumises à la loi française. En cas de
                litige, l&apos;Éditeur et l&apos;Organisation s&apos;engagent à
                coopérer avec diligence et bonne foi en vue de parvenir à une
                solution amiable, par voie de transaction, de médiation et de
                conciliation.
              </p>
              <p>
                Toutefois, si aucun accord n&apos;est trouvé dans un délai de
                deux mois, la juridiction compétente est le tribunal
                administratif de Paris.
              </p>
            </div>
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
