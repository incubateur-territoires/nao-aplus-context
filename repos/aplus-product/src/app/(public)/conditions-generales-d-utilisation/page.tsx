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
            currentPageLabel="Conditions générales d'utilisation"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <div className="gap-4 my-6 ">
            <h1>Conditions générales d&apos;utilisation</h1>
            <div className="p-4 md:p-20 bg-white mt-8 relative">
              <p className="fr-text--lg fr-text--bold">
                En vigueur à partir du 01/10/2026
              </p>

              <h2 className="fr-mt-4w">Article 1 - Champ d’application</h2>
              <p>
                Les présentes conditions générales d’utilisation (ci-après « CGU
                ») précisent le cadre juridique d’Administration+ (ci-après le «
                Produit ») de l’Agence nationale de la cohésion des territoires
                (ANCT) et définissent les conditions d’accès et d’utilisation
                des Services par l’Utilisateur.
              </p>
              <p>
                L’annexe relative à l’accord sur le traitement des données, au
                sens de l’article 28-3 du RGPD, fait partie intégrante des
                présentes CGU.
              </p>

              <h2 className="fr-mt-4w">Article 2 - Objet du Produit</h2>
              <p>
                Administration+ est un produit numérique développé au sein de
                l’ANCT dans le but de mettre en relation des aidants
                professionnels mandatés dans le cadre de leur fonction (ci-après
                « Aidant ») par des usagers avec des agents habilités (ci-après
                « Opérateurs ») pour résoudre des blocages administratifs
                complexes et/ou urgents d’usagers.
              </p>

              <h2 className="fr-mt-4w">Article 3 - Définitions</h2>
              <p>
                <strong>« Organisation »</strong> désigne un organisme chargé
                d’une mission de service public administratif conformément à
                l’article L. 100-3 du code des relations entre le public et
                l’administration (CRPA) qui emploie des Aidants et Opérateurs.
              </p>
              <p>
                <strong>« Administrateur »</strong> désigne l’utilisateur qui
                dispose des droits les plus élevés. Il s’agit de toute personne
                physique, membre de l’équipe du Produit numérique qui s’assure
                du bon fonctionnement de l’outil et de la parfaite mise en
                relation entre l’Aidant et l’Opérateur.
              </p>
              <p>
                <strong>« Aidant »</strong> désigne toute personne physique,
                habilitée par son Organisation qui a conclu un mandat écrit
                généré par le Produit numérique avec l’usager accompagné (par le
                biais de son Organisation ou via le Produit numérique) et
                qualifie/reformule ses signalements auprès de l’Opérateur.
              </p>
              <p>
                <strong>« Éditeur »</strong> désigne la personne morale qui met
                à la disposition du public le Produit numérique, à savoir
                l’ANCT.
              </p>
              <p>
                <strong>« Opérateur »</strong> désigne toute personne physique
                habilitée par son Organisation et qui est saisie par écrit par
                un Aidant pour débloquer rapidement une situation administrative
                complexe et/ou urgente.
              </p>
              <p>
                <strong>« Produit numérique »</strong> désigne le service
                numérique qui permet aux agents habilités de résoudre les
                problématiques administratives complexes et/ou urgentes des
                usagers.
              </p>
              <p>
                <strong>« Responsable d’équipe »</strong> désigne toute personne
                physique habilitée par son Organisation chargée de gérer
                l’utilisation du Produit numérique dans son ou ses
                établissements et sur son territoire.
              </p>
              <p>
                <strong>« Superviseur »</strong> désigne toute personne physique
                habilitée par son Organisation pour piloter l’activité ou
                faciliter l’organisation et l’utilisation du Produit numérique
                dans son organisation et sur son / ses territoires.
              </p>
              <p>
                <strong>« Services »</strong> désigne les fonctionnalités
                proposées par le Produit numérique pour répondre à ses
                finalités.
              </p>
              <p>
                <strong>« Utilisateur »</strong> désigne toute personne physique
                habilitée, qui s’inscrit sur le Produit numérique.
              </p>

              <h2 className="fr-mt-4w">
                Article 4 - Fonctionnalités du Produit
              </h2>

              <h3 className="fr-mt-3w">4.1 Inscription sur le Produit</h3>
              <p>
                L’Organisation désigne un Responsable d’équipe primaire ou
                Superviseur dont elle communique le nom et les coordonnées à
                l’Administrateur du Produit. Sur cette base, l’administrateur
                crée un compte pour ce Responsable d’équipe primaire. C’est
                ensuite au Responsable d’équipe primaire, une fois son compte
                créé, de créer les comptes des membres de son équipe,
                c’est-à-dire des utilisateurs de son organisation. Il peut
                également désigner des Responsables d’équipe qui eux-mêmes
                pourront créer des comptes d’Utilisateur pour leur équipe.
              </p>
              <p>
                Les responsables, primaire ou non, auront également la
                responsabilité de supprimer les comptes de leur équipe.
              </p>
              <p>
                En désignant son Responsable d’équipe primaire, l’Organisation
                accepte les présentes CGU et leur annexe relative au traitement
                des données. Cette acceptation ne dispense pas chaque
                Utilisateur d’accepter personnellement les CGU lors de sa
                première connexion.
              </p>

              <h3 className="fr-mt-3w">
                4.2 Connexion au compte sur le Produit
              </h3>
              <p>
                Pour se connecter à son compte, l’Utilisateur renseigne son
                adresse courriel professionnelle ainsi qu’un mot de passe sur le
                Produit numérique.
              </p>

              <h3 className="fr-mt-3w">4.3 Rôles de l’Utilisateur</h3>
              <p>L’Utilisateur est soit :</p>
              <ul>
                <li>
                  <strong>Un Aidant</strong> qui est en contact direct avec les
                  usagers, pour qualifier et reformuler les signalements avant
                  de les transmettre aux Opérateurs, là où leur intervention
                  peut permettre une résolution. L’Aidant a, au préalable,
                  conclu un mandat écrit avec l’usager généré par le Produit
                  numérique ;
                </li>
                <li>
                  <strong>Un Opérateur</strong> qui soit a été saisi par un
                  Aidant pour répondre à un problème administratif urgent et/ou
                  complexe, ou soit qui invite ou est invité par un autre
                  Opérateur sur un signalement. Les Opérateurs apportent une
                  réponse directe aux usagers à travers les canaux de
                  communication personnalisés qu’ils utilisent d’ordinaire. Ils
                  peuvent également apporter une réponse à l’Aidant si
                  nécessaire ;
                </li>
                <li>
                  <strong>Un Responsable d’équipe primaire</strong> désigné par
                  son Organisation qui est le premier responsable d’une équipe.
                  Ce responsable peut nommer d’autres responsables au sein de
                  son équipe, créer des comptes et retirer des comptes de
                  l’équipe.
                </li>
                <li>
                  <strong>Un Responsable d’équipe</strong> qui gère également
                  l’utilisation du Produit numérique au sein de son Organisation
                  (création et désactivation des comptes utilisateurs, création
                  d’équipes).
                </li>
                <li>
                  <strong>Un Superviseur</strong> désigné par son organisation,
                  qui peut créer et gérer des équipes sur un ou plusieurs
                  territoires, et créer ou désactiver des comptes utilisateurs
                  de son Organisation. Par principe, il n’a pas accès au contenu
                  des signalements.
                </li>
                <li>
                  <strong>Un Administrateur</strong> qui s’assure du bon
                  fonctionnement du Produit numérique, assiste les Utilisateurs
                  en cas de problématique technique ou fonctionnelle et atteste
                  de la parfaite mise en relation entre l’Aidant et l’Opérateur.
                  Par principe, il n’a pas accès au contenu des signalements.
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
                      <td>Phase 1 : Ouverture du signalement</td>
                      <td>Aidant, Opérateur</td>
                      <td>
                        Accès complet aux données et fichiers en pièce jointe
                      </td>
                      <td>Jusqu’à fermeture</td>
                      <td>Phase active de traitement du signalement</td>
                    </tr>
                    <tr>
                      <td>Phase 2 : Fermeture du signalement</td>
                      <td>Aidant, Opérateur</td>
                      <td>Accès complet aux données</td>
                      <td>6 mois après la fermeture du signalement</td>
                      <td>
                        L’aidant ferme le signalement, ou le signalement est
                        fermé automatiquement au bout de 30 jours, un délai de 6
                        mois s’ouvre*
                      </td>
                    </tr>
                    <tr>
                      <td>Phase 3 : Anonymisation des données citoyens</td>
                      <td>Administrateurs uniquement</td>
                      <td>
                        Accès aux données des signalements sans données
                        personnelles**
                      </td>
                      <td>Définitif</td>
                      <td>
                        Pour restauration technique en cas de problème technique
                        et pour un usage statistique
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="fr-text--sm">
                * Tous les jours à 3h du matin, une tâche automatique passe sur
                les signalements fermés depuis plus de 6 mois et efface leurs
                données personnelles (nom, prénom, date de naissance, téléphone,
                adresse, numéros identifiants - NIR/CAF/NIF/MSA -, les pièces
                jointes, mail, détails de vie personnelle). Le signalement
                disparaît de l’interface. On garde seulement les métadonnées
                (dates, territoire, équipes concernées) pour les statistiques.
              </p>
              <p className="fr-text--sm">
                ** Données stockées : date et heure de création, organisme
                sollicitant et organisme recevant le signalement, date de
                clôture, territoire de la demande, pertinence de la demande,
                utilité de la réponse, contenu du signalement (caviardé - sans
                données personnelles).
              </p>

              <h3 className="fr-mt-3w">
                4.4 Collecte de données hautement personnelles par certaines
                Organisations
              </h3>
              <p>
                Seules certaines Organisations habilitées, eu égard à leurs
                missions et compétences peuvent renseigner certaines
                informations notamment le numéro fiscal de référence,
                l’identifiant Caisse d’Allocation Familiale (CAF) et Mutuelle
                Sociale Agricole (MSA) sur le Produit numérique. Les champs
                permettant de les renseigner ne sont visibles que pour ces
                Organisations habilitées.
              </p>
              <p>
                Lorsqu’une Organisation mentionnée par le décret n° 2019-341 du
                19 avril 2019 demande que le NIR figure dans les signalements
                qui lui sont adressés, elle devient responsable de traitement,
                au sens du RGPD, du NIR, pour les opérations qu’elle réalise, y
                compris lorsque ces signalements ont été créés par un Aidant
                relevant d’une autre Organisation. L’Organisation dont relève
                l’Aidant demeure responsable de traitement pour la création et
                la transmission du signalement.
              </p>
              <p>
                De son côté, l’ANCT agit en qualité de sous-traitant,
                conformément au RGPD et à l’accord sur le traitement des données
                en annexe des présentes CGU.
              </p>

              <h2 className="fr-mt-4w">
                Article 5 : Responsabilités de l’ANCT
              </h2>

              <h3 className="fr-mt-3w">5.1 Généralités</h3>
              <p>
                L’ANCT s’engage à la sécurisation du Produit, notamment en
                prenant toutes les mesures nécessaires permettant de garantir la
                sécurité et la confidentialité des informations fournies.
                Toutefois, il n’est pas garanti que le Produit soit exempt
                d’anomalies ou d’erreurs.
              </p>
              <p>
                L’ANCT ne saurait être rendue responsable en cas d’utilisation
                du Produit contraire aux présentes CGU ou en cas de force
                majeure.
              </p>
              <p>
                De plus, elle s’exonère de responsabilité en cas
                d’indisponibilité dans le cas où celle-ci n’excèderait pas les
                garanties de services définis à l’article 5.2.
              </p>

              <h3 className="fr-mt-3w">5.2 Garanties de services</h3>

              <h4 className="fr-h6 fr-mt-3w">5.2.1 Disponibilité du Produit</h4>
              <p>
                La plage d’ouverture du Produit est 24h/24 7j/7, hors période
                d’indisponibilité pour maintenance.
              </p>
              <p>
                L’ANCT poursuit un objectif de disponibilité annuelle du Produit
                de 99,5%, hors indisponibilités planifiées. En cas d’incident ou
                de maintenance, elle vise un délai de rétablissement de 12h.
              </p>
              <p>
                Dans le cadre d’une maintenance de l’environnement d’exécution
                du Produit, l’ANCT se réserve le droit de suspendre
                temporairement le fonctionnement du Produit. Elle tient informée
                les Utilisateurs au minimum 48h à l’avance en cas
                d’indisponibilité prévisible. En cas d’urgence, cette suspension
                peut intervenir sans préavis.
              </p>
              <p>
                Ces arrêts exceptionnels peuvent être rendus nécessaires par
                exemple pour des opérations de gestion des données en back
                office, des opérations de mise en production ou des changements
                d’architecture qui, par nature, n’auraient pas pu être
                anticipées.
              </p>

              <h4 className="fr-h6 fr-mt-3w">5.2.2 Sécurité du Produit</h4>
              <p>
                L’ANCT prend toutes les précautions utiles pour préserver la
                sécurité du Produit et des outils mis en œuvre pour réaliser son
                fonctionnement, notamment s’agissant de l’accès au Produit, de
                la gestion des comptes utilisateurs et du traitement des données
                collectées.
              </p>
              <p>
                Tout Utilisateur peut signaler les éventuels dysfonctionnements
                ou non-conformités aux présentes CGU à l’ANCT via l’adresse
                suivante :{" "}
                <a href={ROUTE.CONTACT}>https://aplus.beta.gouv.fr/contact</a>
              </p>
              <p>
                Le Produit est en cours d’homologation de sécurité, établie au
                regard du référentiel général de sécurité (RGS) de l’Agence
                nationale de la cohésion des territoires (ANCT).
              </p>

              <h4 className="fr-h6 fr-mt-3w">5.2.3 Support</h4>
              <p>
                L’ANCT assure le support auprès de l’ensemble des Utilisateurs.
              </p>
              <p>
                Le support de l’ANCT est disponible les jours ouvrés sur une
                amplitude horaire de 9h à 18h. Il est joignable à l’adresse
                suivante :{" "}
                <a href={ROUTE.CONTACT}>https://aplus.beta.gouv.fr/contact</a>
              </p>

              <h3 className="fr-mt-3w">
                5.3 Contrôle de l’utilisation du Produit
              </h3>
              <p>
                L’ANCT est autorisé à suspendre, voire à supprimer, un compte si
                l’utilisation du Produit contrevient aux obligations de
                sécurité, méconnait les présentes CGU ou contrevient à des
                dispositions légales ou réglementaires. Elle motive sa décision
                en faits et en droit.
              </p>
              <p>
                En aucun cas, l’Éditeur n’est responsable de l’habilitation d’un
                Utilisateur, celle-ci relève uniquement de la responsabilité de
                l’Organisation dont il fait partie.
              </p>
              <p>
                L’Éditeur ne saurait être tenu responsable de tout contenu
                publié par l’Utilisateur sur le Produit numérique, notamment des
                fausses informations renseignées par ce dernier.
              </p>

              <h2 className="fr-mt-4w">
                Article 6 : Responsabilités de l’Utilisateur
              </h2>
              <p>
                Les Utilisateurs s’engagent à respecter les présentes CGU et à
                utiliser le Produit conformément à la législation en vigueur.
                Les présentes CGU sont portées à la connaissance des
                Utilisateurs lors de la demande de création d’un compte. La
                confirmation de la création du compte vaut acceptation des CGU
                par les Utilisateurs concernés.
              </p>
              <p>
                L’Utilisateur s’assure de garder son identifiant et mot de passe
                secrets. Toute divulgation, quelle que soit sa forme, est
                strictement interdite. Il assume les risques liés à
                l’utilisation de son adresse courriel.
              </p>
              <p>
                Lors de la création d’un compte sur le Produit Numérique, le
                Responsable d’équipe s’assure que la personne dont le compte est
                créé est bien habilitée par son Organisation à répondre aux
                signalements de blocage administratif par le biais du Produit
                numérique. Lors de la première connexion, ce nouvel utilisateur
                devra accepter les présentes CGU.
              </p>
              <p>
                Les Utilisateurs agissent pour le compte et sous l’autorité de
                l’Organisation dont ils relèvent. Toute information transmise
                par l’Utilisateur est de la responsabilité de son Organisation
                de rattachement. Les Organisations qui souhaitent obtenir le
                champ relatif au NIR dans les signalements engagent leur
                responsabilité et deviennent responsables de traitement au sens
                du RGPD.
              </p>
              <p>
                Il est rappelé que toute personne procédant à une fausse
                déclaration pour elle-même ou pour autrui s’expose notamment aux
                sanctions prévues à l’article 441-1 du code pénal, prévoyant des
                peines pouvant aller jusqu’à trois ans d’emprisonnement et 45
                000 euros d’amende.
              </p>
              <p>
                L’Utilisateur s’engage formellement par les présentes CGU à ne
                pas mettre en ligne de contenus ou informations contraires aux
                dispositions légales et réglementaires en vigueur. Il veille
                également à ne pas communiquer de données sensibles ou de
                secrets protégés par la loi, et à ne pas publier de contenus
                illicites notamment dans les zones de champs libres.
              </p>
              <p>
                L’Aidant certifie avoir recueilli l’autorisation de l’usager
                pour le traitement de sa demande par un Opérateur sur le Produit
                numérique. Il s’engage également à clôturer le signalement
                lorsque l’Opérateur indique qu’elle est résolue.
              </p>
              <p>
                Le Responsable d’équipe s’engage à désactiver le compte de tout
                Aidant ou Opérateur qui quitte ses fonctions. Si un compte
                Utilisateur est inactif pendant plus de 6 mois, son compte sera
                désactivé par l’Administrateur et le Responsable d’équipe devra
                contacter l’Administrateur pour le faire réactiver.
              </p>

              <h2 className="fr-mt-4w">Article 7 - Mise à jour des CGU</h2>
              <p>
                Les termes des présentes CGU peuvent être amendés à tout moment,
                en fonction des modifications apportées au Produit numérique, de
                l’évolution de la législation ou pour tout autre motif jugé
                nécessaire.
              </p>
              <p>
                Chaque modification donne lieu à une nouvelle version qui doit
                être acceptée par l’Utilisateur selon les modalités prévues par
                le Produit numérique.
              </p>

              <h2 className="fr-mt-4w">
                Article 8 - Loi applicable et juridiction compétente
              </h2>
              <p>
                Les présentes CGU sont soumises à la loi française. En cas de
                litige, l’Éditeur et l’Organisation s’engagent à coopérer avec
                diligence et bonne foi en vue de parvenir à une solution
                amiable, par voie de transaction, de médiation et de
                conciliation.
              </p>
              <p>
                Toutefois, si aucun accord n’est trouvé dans un délai de deux
                mois pour toute contestation ou litige relatif aux CGU, la
                juridiction compétente est le tribunal administratif de Paris.
              </p>

              <hr className="fr-mt-6w" />

              <h2 className="fr-mt-4w">
                Contrat de sous-traitance des données à caractère personnel
              </h2>

              <h3 className="fr-mt-3w">Préambule</h3>
              <p>
                L’ANCT est responsable de traitement des informations relatives
                à l’Utilisateur, en ce qui concerne l’inscription et la
                connexion de ce dernier au Produit numérique.
              </p>
              <p>
                Chaque Organisation est responsable de l’habilitation de ses
                Utilisateurs.
              </p>
              <p>
                Chaque Organisation dont relèvent les Aidants et Opérateurs
                utilisant le Produit numérique est responsable de traitement.
              </p>
              <p>
                Le NIR (Numéro d’Inscription au Répertoire national
                d’identification des personnes physiques) fait l’objet d’un
                traitement spécifique. Les Organisations habilitées par le
                décret NIR et ayant demandé à ce que ce numéro leur soit
                transmis pour régler les situations administratives deviennent
                responsables de traitement au sens du RGPD.
              </p>
              <p>
                Dans ce cadre, l’ANCT est sous-traitant puisqu’elle agit pour le
                compte de l’Organisation, Opérateur ou Aidant, et selon ses
                instructions documentées.
              </p>

              <h3 className="fr-mt-3w">
                Article 1 - Objet et champ d’application
              </h3>
              <p>
                Le présent accord sur le traitement de données a pour objet de
                garantir la conformité avec l’article 28, paragraphes 2, 3 et 4
                du règlement (UE) 2016/679 du Parlement européen et du Conseil
                du 27 avril 2016 relatif à la protection des personnes physiques
                à l’égard du traitement des données à caractère personnel et à
                la libre circulation de ces données, et abrogeant la directive
                95/46/CE (règlement général sur la protection des données,
                ci-après « RGPD »).
              </p>
              <p>
                Il s’applique au traitement des données à caractère personnel
                tel que décrit à l’article 2 ci-après.
              </p>

              <h3 className="fr-mt-3w">
                Article 2 - Description du traitement des données à caractère
                personnel
              </h3>
              <p>
                L’ANCT met à disposition des Utilisateurs le produit
                Administration+.
              </p>
              <ul>
                <li>
                  <strong>
                    Finalité pour laquelle les données à caractère personnel
                    sont traitées
                  </strong>{" "}
                  pour le compte du responsable de traitement : permettre la
                  coopération entre des Aidants mandatés et des Opérateurs
                  habilités pour résoudre des blocages ou traitées des
                  signalements urgents rencontrés par des usagers ;
                </li>
                <li>
                  <strong>Nature du traitement</strong> : la mise en place d’un
                  service public numérique mettant en relation des Aidants
                  mandatés par des usagers et des Opérateurs habilités à
                  résoudre les signalements urgents et/ou complexes des usagers
                  ;
                </li>
                <li>
                  <strong>Catégories de personnes concernées</strong> dont les
                  données à caractère personnel sont traitées : les usagers ;
                </li>
                <li>
                  <strong>
                    Catégories de données à caractère personnel pouvant être
                    traitées
                  </strong>{" "}
                  : nom, prénom, adresse courriel, numéro de téléphone, adresse
                  postale, date de naissance, champs libres, messages échangés
                  et pièces jointes. Seules les Organisations habilitées, eu
                  égard à leurs missions et compétences, peuvent traiter le NIR
                  ;
                </li>
                <li>
                  <strong>Durée du traitement</strong> : pendant toute la durée
                  du contrat. Il peut prendre fin à tout moment en cas de
                  résiliation des CGU par l’Organisation ou l’ANCT.
                </li>
              </ul>
              <p>
                À la demande de l’Organisation, en sa qualité de sous-traitant,
                l’ANCT conserve les données relatives aux signalements pendant 6
                mois après leur fermeture par un Aidant. Ces données sont
                anonymisées après ce délai de 6 mois et les pièces jointes
                supprimées.
              </p>
              <p>
                Les Utilisateurs sont informés des conditions générales
                d’utilisation du service. Chaque utilisateur peut être contacté
                via l’adresse de messagerie collectée lors de la création de son
                compte, pour tous contacts nécessaires. De plus, l’utilisateur
                est informé que les données à caractère personnel qu’il
                communique pourront être transmises et exploitées par le
                responsable de traitement concerné.
              </p>
              <p>
                Chacune des Organisation est responsable de son traitement et
                des données qu’elle traite. Seuls les agents autorisés, à raison
                de leurs attributions respectives et dans la limite du besoin
                d’en connaître, peuvent accéder aux données à caractère
                personnel strictement nécessaires à leur mission. Le responsable
                de traitement garantit à l’utilisateur le respect des données
                communiquées et veille à leur intégrité.
              </p>

              <h3 className="fr-mt-3w">
                Article 3 - Instruction documentée du responsable de traitement
                et transferts internationaux
              </h3>
              <p>
                L’ANCT en sa qualité d’exploitant du service, s’engage à
                n’opérer aucune commercialisation des informations personnelles
                transmises par l’Organisation ou utilisateur du service et à ne
                pas les communiquer à des tiers. Pour rappel, l’ANCT a un rôle
                de sous-traitant au sens du RGPD.
              </p>
              <p>
                L’ANCT ne traite les données à caractère personnel des usagers
                que sur instruction documentée de l’Organisation, responsable de
                traitement, y compris en ce qui concerne les transferts de
                données à caractère personnel en dehors de l’Union européenne, à
                moins que l’ANCT soit tenue de les traiter en vertu du droit
                européen ou français. Le cas échéant, l’ANCT informe
                l’Organisation de cette obligation juridique avant le
                traitement, sauf si le droit européen ou français lui interdit
                une telle information pour des motifs d’intérêt public. En cas
                de transfert vers un pays tiers, l’ANCT et les sous-traitants
                ultérieurs garantissent notamment le respect du chapitre V du
                RGPD.
              </p>
              <p>
                Des instructions peuvent également être données ultérieurement
                par l’Organisation pendant toute la durée du traitement. Ces
                instructions doivent toujours être documentées.
              </p>
              <p>
                L’ANCT informe immédiatement l’Organisation dans le cas où l’une
                de ses instructions en tant que responsable de traitement
                constitue une violation du RGPD ou d’autres dispositions du
                droit européen ou du droit français.
              </p>

              <h3 className="fr-mt-3w">
                Article 4 - Limitation de la finalité
              </h3>
              <p>
                L’ANCT ne traite les données à caractère personnel que pour la
                finalité de traitement définie à l’article 2, sauf instruction
                complémentaire de l’Organisation.
              </p>
              <p>
                Les données sont traitées de manière anonymisée pour des besoins
                statistiques afin d’analyser, pour le compte des Organisations
                utilisatrices, l’usage du produit et améliorer son
                fonctionnement.
              </p>

              <h3 className="fr-mt-3w">Article 5 - Durée du traitement</h3>
              <p>
                Le traitement par l’ANCT n’a lieu que pendant la durée précisée
                à l’article 2, à savoir pendant toute la durée du contrat.
              </p>

              <h3 className="fr-mt-3w">Article 6 - Sécurité du traitement</h3>
              <p>
                L’ANCT met au moins en œuvre des mesures techniques et
                organisationnelles appropriées pour assurer la sécurité des
                données à caractère personnel de manière à ce que le traitement
                réponde aux exigences de l’article 32 du RGPD et garantisse la
                protection des droits de la personne concernée. Ces mesures sont
                notamment les suivantes :
              </p>
              <ul>
                <li>
                  Logs applicatifs, serveur HDS (hébergement de données de
                  santé), chiffrement de toute donnée sortante du serveur, pas
                  de visibilité des données personnelles pour les utilisateurs
                  privilégiés, base de données anonymisée pour les statistiques.
                </li>
              </ul>
              <p>
                Figure parmi ces mesures la protection des données contre toute
                violation de la sécurité entraînant, de manière accidentelle ou
                illicite, la destruction, la perte, l’altération, la divulgation
                non autorisée de données à caractère personnel ou l’accès non
                autorisé à de telles données (violation de données à caractère
                personnel).
              </p>
              <p>
                Lors de l’évaluation du niveau de sécurité approprié, les
                parties tiennent dûment compte de l’état des connaissances, des
                coûts de mise en œuvre et de la nature, de la portée, du
                contexte et des finalités du traitement, ainsi que des risques
                pour les personnes concernées, à savoir les usagers.
              </p>
              <p>
                L’ANCT n’accorde aux utilisateurs du Produit numérique l’accès
                aux données à caractère personnel faisant l’objet du traitement
                que dans la mesure strictement nécessaire à l’exécution, à la
                gestion et au suivi du contrat. L’ANCT veille également à ce que
                les personnes autorisées à traiter les données à caractère
                personnel s’engagent à respecter la confidentialité ou soient
                soumises à une obligation légale appropriée de confidentialité.
              </p>
              <p>
                Particulièrement, lorsque le traitement porte sur des données à
                caractère personnel relevant des articles 9 et 10 du RGPD ou sur
                la donnée encadrée par l’article 30 de la loi n° 78-17 du 6
                janvier 1978 modifiée, l’ANCT et l’Organisation s’assurent que
                les mesures de sécurité adéquates sont prises.
              </p>

              <h3 className="fr-mt-3w">
                Article 7 - Documentation et conformité
              </h3>
              <p>
                L’ANCT traite de manière rapide et adéquate les demandes de
                l’Organisation concernant le traitement des données.
              </p>
              <p>
                Le Produit numérique fait l’objet de la part de l’Organisation,
                responsable de traitement, d’un dossier de conformité à la
                protection de la vie privée auprès de son délégué à la
                protection des données.
              </p>
              <p>
                Au niveau de la documentation, l’ANCT met à la disposition de
                l’Organisation toutes les informations nécessaires pour
                démontrer le respect des obligations prévues par le RGPD et des
                présentes clauses.
              </p>
              <p>
                À la demande de l’Organisation, l’ANCT permet également la
                réalisation d’audits des activités de traitement couvertes par
                le présent accord et y contribue, à intervalles raisonnables ou
                en présence d’indices de non-conformité.
              </p>
              <p>
                L’Organisation peut décider de procéder elle-même à l’audit ou
                de mandater un auditeur indépendant.
              </p>
              <p>
                L’ANCT et l’Organisation mettent à la disposition de l’autorité
                de contrôle compétente, dès qu’elle en fait la demande, les
                informations susvisées y compris les résultats de tout audit.
              </p>

              <h3 className="fr-mt-3w">
                Article 8 - Recours à des sous-traitants ultérieurs
              </h3>
              <p>
                L’ANCT, en qualité de sous-traitant initial dispose de
                l’autorisation générale de l’Organisation pour faire appel à un
                sous-traitant ultérieur dans le respect des règles régissant la
                commande publique.
              </p>
              <p>
                L’ANCT garantit notamment que ses sous-traitants sont soumis aux
                mêmes obligations en matière de confidentialité et de sécurité,
                prévues par un accord sur le traitement des données conformément
                à l’article 28-3 du RGPD.
              </p>
              <p>
                À la demande de l’Organisation, l’ANCT lui fournit une copie de
                ce contrat conclu avec le sous-traitant ultérieur et de toute
                modification apportée ultérieurement.
              </p>
              <p>
                L’ANCT demeure pleinement responsable, à l’égard de
                l’Organisation, de l’exécution des obligations du sous-traitant
                ultérieur conformément au contrat conclu avec ce dernier. L’ANCT
                informe l’Organisation de tout manquement du sous-traitant
                ultérieur à ses obligations contractuelles.
              </p>
              <p>
                Les sous-traitants ultérieurs sont précisés dans la{" "}
                <a href={ROUTE.DONNEES_PERSONNELLES}>
                  politique de confidentialité
                </a>{" "}
                du Produit numérique.
              </p>

              <h3 className="fr-mt-3w">
                Article 9 - Assistance au responsable de traitement
              </h3>
              <p>
                L’ANCT informe sans délai l’Organisation de toute demande reçue
                de la part de la personne concernée. L’ANCT ne donne pas
                elle-même suite à cette demande, à moins que l’Organisation ne
                l’autorise.
              </p>
              <p>
                L’ANCT prête assistance à l’Organisation pour ce qui est de
                remplir l’obligation qui lui incombe de répondre aux demandes
                des personnes concernées d’exercer leurs droits, en tenant
                compte de la nature du traitement et des informations dont il
                dispose en tant que sous-traitant. L’Organisation met à
                disposition de l’ANCT une adresse de contact permettant aux
                utilisateurs d’exercer ces droits.
              </p>
              <p>
                L’ANCT aide l’Organisation à garantir le respect des obligations
                prévues aux articles 32 à 36 du RGPD et notamment :
              </p>
              <ul>
                <li>
                  Garantir la confidentialité et la sécurité des données à
                  caractère personnel ;
                </li>
                <li>
                  Notifier à l’Organisation toute violation de données à
                  caractère personnel dans les meilleurs délais après en avoir
                  pris connaissance ;
                </li>
                <li>
                  Prêter assistance en cas de violation de données en rapport
                  avec des données traitées par l’Organisation ;
                </li>
                <li>
                  Appuyer l’Organisation dans le cas où une analyse d’impact
                  relative à la protection des données doit être réalisée ou si
                  l’autorité de contrôle doit être préalablement consultée ;
                </li>
                <li>
                  Veiller à ce que les données à caractère personnel soient
                  exactes et à jour, en informant sans délai l’Organisation si
                  les données traitées sont inexactes ou devenues obsolètes.
                </li>
              </ul>
              <p>
                En cas de violation de données à caractère personnel, l’ANCT
                coopère avec l’Organisation et lui prête assistance aux fins de
                la mise en conformité avec les obligations qui lui incombent en
                vertu des articles 33 et 34 du RGPD, en tenant compte de la
                nature du traitement et des informations dont dispose l’ANCT.
              </p>

              <h3 className="fr-mt-3w">
                Article 10 - Suppression des données à caractère personnel
              </h3>
              <p>
                Au terme du contrat, l’ANCT, selon le choix de l’Organisation,
                supprime toutes les données à caractère personnel traitées sur
                le Produit numérique ou les renvoie à l’Organisation, et détruit
                les copies existantes sauf si le droit européen ou français n’en
                exige la conservation.
              </p>
            </div>
          </div>
        </Container>
      </div>
    </HydrateClient>
  );
}
