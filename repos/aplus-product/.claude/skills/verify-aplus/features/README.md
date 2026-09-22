# Carte de vérification Administration+

Ce dossier est la source maintenue pour vérifier le comportement visible d'Administration+. Lis cet index avant de piloter l'app, puis prends la fiche de la feature concernée comme recette.

## Le domaine en cinq phrases

Un **aidant** (France Services, travailleur social, agent de mairie) accompagne un usager bloqué face à une administration. Il crée un **signalement** décrivant la situation du **citoyen**, et l'adresse à une ou plusieurs **équipes opératrices** (CAF, CPAM, France Travail, DGFIP, ANTS…) compétentes sur un **territoire** (un département). Les équipes sollicitées répondent dans un fil d'échanges et font avancer le signalement : `PENDING_ASSIGNMENT` → `IN_TREATMENT` → `COMPLETED` ou `CLOSED`. Les **superviseurs** pilotent plusieurs équipes, les **admins** administrent le service. Les statistiques publiques exposent les volumes et les délais de prise en charge.

Un utilisateur porte un `role` (`user`, `supervisor`, `admin`) et appartient à une ou plusieurs `Team`, elles-mêmes rattachées à une `Organization` et à des `Area` (territoires). Le `TeamType` (`OPERATOR`, `FRANCE_SERVICE`, `HISTORICAL_SOCIAL_WORKER`, `TZNR`, `OTHERS_HELPERS`) décide qui peut créer et qui doit répondre.

## Préconditions de base

- Lancer l'app avec `.claude/skills/verify-aplus/scripts/aplus-verify launch` (`http://localhost:3000`).
- Passer `aplus-verify doctor`. La base pointée est celle de staging : c'est le mode de développement normal, mais les écritures sont partagées.
- Choisir un compte avec `aplus-verify users [role]`. Utiliser `aplus-verify login <email>` pour atteindre un état connecté, `login --ui` pour vérifier la connexion elle-même.
- Ne jamais piloter une instance que ce run n'a pas démarrée ou explicitement reconnue.
- Prendre un compte `user` ou `supervisor` par défaut : un `admin` sans 2FA est bloqué sur `/configurer-2fa`.
- Pour tout parcours signalement, prendre un compte `user` : un `supervisor` comme un `admin` reçoit les données de signalement masquées (`maskReportsForRole`).

## Conventions de pilotage

- Repartir de l'état de base sauf mention contraire dans les préconditions de la fiche.
- Préférer les rôles ARIA et les noms accessibles aux sélecteurs CSS et à la position dans le DOM.
- Traiter chaque commande comme littérale : ne pas modifier les noms entre guillemets ni les options.
- Saisir avec `type` sur une référence de `snapshot`, jamais avec `fill` : React ignore `fill`.
- Faire `scrollintoview` avant tout `click` : un clic hors viewport ne fait rien et ne signale rien.
- Cliquer les boutons d'action avec `aplus-verify click`, jamais `agent-browser click` : ce dernier n'atteint pas de façon fiable les gestionnaires React. Juger sur l'effet observable, pas sur le `✓ Done`.
- Lire les titres dans le `snapshot`, jamais par `querySelector("h1")` : la modale DSFR masquée fournit un premier `<h1>`.
- Attendre `wait --load networkidle` puis ≈ 2 s après chaque navigation, avant toute saisie.
- Re-`snapshot` après chaque changement de page : les `@refs` deviennent obsolètes.

## Preuves et signalement des impasses

- Capturer l'action **et** l'état résultant, pas seulement l'écran final.
- Une preuve UI comprend un `snapshot -i` et un `screenshot` où l'identité de l'app est visible.
- Une preuve de mutation comprend une seconde lecture indépendante via `aplus-verify sql`.
- Confirmer dans `/tmp/aplus-verify/dev-server.log` que la requête a bien été émise et son code HTTP.
- Consigner l'identifiant de la feature et le point d'entrée utilisé avec chaque artefact.
- Rapporter un chemin inatteignable avec la commande tentée et la précondition non remplie ; ne jamais présenter comme vérifié un point d'entrée contourné par un autre chemin.

## Contrat d'une fiche

Un titre H1, un paragraphe de comportement visible, puis exactement quatre H2 : `Sub-features`, `How to get to it (user POV)`, `Driving it with agent-browser`, `Gotchas`.

## Features

- [Authentification et accès](./auth.md) — connexion par mot de passe, 2FA admin, mot de passe oublié, gardes de profil et d'équipe.
- [Liste des signalements](./reports-list.md) — tableau, recherche, filtres par statut, compteurs, export CSV.
- [Création d'un signalement](./report-create.md) — formulaire en 4 étapes, du territoire au récapitulatif.
- [Détail d'un signalement](./report-detail.md) — fil d'échanges, changements de statut, invitation d'équipes, pièces jointes.
- [Équipes](./teams.md) — consultation, création, membres, territoires, types acceptés.
- [Utilisateurs et supervision](./users.md) — annuaire, invitation, désactivation, promotion en superviseur.
- [Statistiques publiques](./stats-public.md) — tableau de bord public, filtres, export par graphique.
- [Golden dataset](./golden-dataset.md) — annotation du corpus, restitution, accord entre annotateurs, adjudication des tags de référence.

## État de vérification

**Vérifié de bout en bout, avec preuve en base ou dans le log serveur :**

- `auth-login` par le vrai formulaire (`login --ui`), `auth-forgot` avec envoi Brevo confirmé
- `list-open`, `list-search` (preuves dans `../evidence/`)
- `detail-open`, `detail-answer` (3 → 4 réponses), `detail-status` (`CLOSED` → `IN_TREATMENT` + ligne d'historique), `detail-close` (retour à `CLOSED`), `detail-read-tracking` (déclenché par la seule ouverture)
- `profile-self` (`profession` modifiée en base puis restaurée)
- `teams-detail` et sa garde d'accès : refus confirmé pour un superviseur non membre d'une équipe hors périmètre, fiche complète une fois membre (rattachement de test posé puis retiré par SQL ; preuves dans `../evidence/`)
- affichage des pages équipes, utilisateurs, statistiques et profil

- `create-open`, `create-validation`, `create-step1` à `create-step4`, `create-submit` : création complète d'un signalement, du territoire à l'envoi, avec la ligne retrouvée en base (`PENDING_ASSIGNMENT`, sujet conforme, `authorId` = compte pilote)

**Dérivé du code sans exécution :** les mutations d'équipe ([teams](./teams.md)), l'invitation et la désactivation d'utilisateur, `detail-invite`, `detail-print`, `detail-coauthors`, `list-export`, les filtres de `stats-public`. À confirmer au premier passage, puis mettre cette section à jour. `/maintain-verification-skill` sert à combler cet écart.

Le parcours `golden-dataset` est cartographié mais **entièrement dérivé du code, sans exécution** : sa fiche est écrite au moment où le comportement est construit, pas après l'avoir piloté. Ses gestes d'adjudication écrivent des tags de référence partagés avec l'équipe, et `golden-adjudicate-unanimous` écrit sur tout le corpus en un clic ; les exercer demande de relever l'état de départ et de savoir le rendre. À confirmer au premier passage live, puis mettre cette section à jour.

À confirmer au prochain passage live : `report.exportCsv` refuse un compte qui n'est ni superviseur, ni admin, ni responsable d'une équipe. La précondition de `reports-list.md` (« compte `user` rattaché à une équipe ») ne suffit donc pas pour `list-export`. La garde n'a pas bougé dans la fenêtre.
