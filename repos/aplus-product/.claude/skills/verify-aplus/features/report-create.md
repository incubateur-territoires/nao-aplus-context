# Création d'un signalement

Un aidant décrit la situation d'un citoyen bloqué et l'adresse aux équipes opératrices compétentes sur son territoire. Le formulaire tient en quatre étapes portées par l'URL, avec validation par étape avant de pouvoir avancer.

## Sub-features

- `create-open` ouvre l'étape 1 depuis la liste des signalements.
- `create-step1` choisit le territoire, le thème et les équipes destinataires.
- `create-step2` saisit l'identité et les coordonnées du citoyen.
- `create-step3` décrit le blocage, la procédure standard suivie, et joint des pièces.
- `create-step4` relit le récapitulatif et valide.
- `create-validation` bloque le passage à l'étape suivante tant que les champs requis sont invalides.
- `create-persist` conserve la saisie lors d'un retour en arrière.
- `create-submit` crée le signalement en `PENDING_ASSIGNMENT` et redirige vers son détail.

## How to get to it (user POV)

- Choisir `Créer un nouveau signalement` sur `/tous-les-signalements`.
- Ouvrir directement `/signalement?step=1`.

## Driving it with agent-browser

Préconditions :

- Session posée sur un compte `user` appartenant à une équipe autorisée à créer (type `FRANCE_SERVICE`, `HISTORICAL_SOCIAL_WORKER`, `TZNR` ou `OTHERS_HELPERS`).
- **Cette recette écrit dans la base de staging partagée.** Choisir un nom de citoyen reconnaissable et le noter avant de commencer.

- **Ouvrir.** Lancer `agent-browser open 'http://localhost:3000/signalement?step=1'` puis `agent-browser wait --load networkidle` et 3 s. Le titre de niveau 1 est `Nouveau signalement` et le titre de niveau 2 `Destinataires du signalement Étape 1 sur 4`.
- **Territoire.** La liste déroulante `Territoire des équipes opérateur` est pré-remplie avec le territoire de l'équipe du compte. Ce n'est qu'un filtre : la changer recharge les équipes proposées en dessous, et les équipes déjà cochées restent sélectionnées. Le territoire enregistré sur le signalement est toujours celui de l'équipe autrice (premier par ordre alphabétique si elle en a plusieurs), calculé côté serveur. Vérifié le 2026-09-28 : une équipe cochée en Val-de-Marne, une autre après passage du filtre sur Paris ; l'étape 4 affiche `Territoire concerné : Val-de-Marne` et la base enregistre `areaId` Val-de-Marne avec les deux destinataires.
- **Thème.** Choisir l'un des neuf boutons de thème : `Retraite`, `Papiers / Titres`, `Logement`, `Gestion d'entreprise`, `Adresse / Courrier`, `Emploi / Formation`, `Impôts / Argent`, `Social / Famille`, `Santé / Handicap`.
- **Destinataires.** Cocher au moins une équipe. Les cases portent le nom de l'équipe suivi de son organisation, par exemple `Caf 22 - CAF`. L'input s'appelle `requestedGroups` et son handler alimente `requestedTeams`. Cocher par `.click()` DOM, pas par `agent-browser click` ni `check` :
  ```bash
  agent-browser eval 'var i=[].slice.call(document.querySelectorAll("input[name=requestedGroups]")).find(function(x){return x.value&&x.value!=="hidden-checkbox"}); i.scrollIntoView({block:"center",behavior:"instant"}); i.click()'
  ```
- **Avancer.** Choisir le bouton de passage à l'étape suivante. L'URL devient `/signalement?step=2` et le titre de niveau 2 `Informations du citoyen`.
- **Validation.** Depuis l'étape 1 vierge, `aplus-verify click --css '[data-testid=step-1-submit-button]'`. Vérifié : l'URL reste `?step=1`, le fieldset prend `fr-fieldset--error`, et un `p.fr-message--error` affiche `Veuillez choisir au moins une équipe opérateur.` Attention à ne pas confondre ce message avec l'aide grise permanente `Veuillez choisir au moins une équipe opérateur` (sans point) de `team-selection-container.tsx`. Le thème n'est qu'un filtre : seuls `area`, `requestedTeams` et `applicantTeam` sont validés.
- **Étape 2.** `Prénom`, `Nom` et `Numéro de téléphone` par `type` sur leurs références. La date de naissance est un `input[type=date]` que ni `type` ni `keyboard type` ne remplissent : utiliser le setter natif (voir SKILL.md). Puis `aplus-verify click "Étape 3 : signalement détaillé"`.
- **Étape 3.** `Sujet du signalement` et `Description du blocage` par `type`, puis `aplus-verify click "Étape 4 : récapitulatif et validation"`.
- **Étape 4.** Si l'équipe autrice compte d'autres membres actifs, un bloc « Inviter des collègues » liste chacun avec une case **cochée par défaut** ; décocher retire le co-auteur. Puis cocher `J'atteste avoir recueilli l'autorisation du citoyen` par `.click()` DOM, et `aplus-verify click "Envoyer le signalement"`.
- **Persistance.** Revenir à l'étape précédente et repartir en avant. Les valeurs saisies sont toujours présentes : le formulaire est porté par un `FormProvider` unique, pas par l'URL.
- **Soumission.** Vérifié de bout en bout : le log serveur contient `report.createReport`, l'URL revient sur `/tous-les-signalements`, et le compte de signalements augmente de un.
- **Preuve de l'effet de bord.** Vérifié : `aplus-verify sql "select id, status, subject from \"Report\" order by \"createdAt\" desc limit 1;"` renvoie le sujet saisi avec le statut `PENDING_ASSIGNMENT`, et `authorId` pointe le compte pilote.
- **Preuve UI.** Lancer `agent-browser screenshot "$PWD/.claude/skills/verify-aplus/evidence/creation-recapitulatif.png"` avant de valider, et un second après redirection sur le détail.

## Gotchas

- Les champs de la section `Informations demandées par le ou les opérateur(s)` de l'étape 2 dérivent des `specificFields` des organisations cochées, donc de la base et non du code. Depuis septembre 2026 la CAF ne demande plus que l'`Identifiant CAF` ; le `Numéro de sécurité sociale NIR` n'apparaît que si CARSAT, CNAM, CNAV, CPAM, CRAM ou MSA est cochée.
- La liste des équipes destinataires dépend du territoire **et** du thème. Changer le territoire ne décoche rien : une équipe cochée sur un autre territoire n'est plus visible dans la liste mais figure au récapitulatif de l'étape 4.
- Le sélecteur `Équipe autrice` n'apparaît que si le compte appartient à plusieurs équipes créatrices. Changer d'équipe autrice à l'étape 1 vide la sélection de co-auteurs : au retour à l'étape 4, ce sont les collègues de la nouvelle équipe qui sont cochés par défaut. Vérifié de bout en bout (état des cases, puis `_ReportCoAuthors` en base après soumission).
- Les noms d'équipe sont longs et contiennent des apostrophes typographiques (`Côtes-d'Armor` avec `’`). Cibler par rôle et nom accessible plutôt que par sélecteur CSS, et copier le libellé du `snapshot` sans le retaper.
- L'étape est portée par le paramètre `step` de l'URL, mais l'état du formulaire vit en mémoire React. Ouvrir directement `?step=3` donne un formulaire vide, pas une reprise.
- Un signalement créé part dans les données partagées de l'équipe et déclenche de vraies notifications aux équipes destinataires. Les comptes concernés sont anonymisés, donc sans conséquence ; `aplus-verify mailrisk` confirme s'il existe une exception.
- Il n'existe pas de suppression depuis l'interface : un signalement créé pour un test reste visible. Ne pas créer en boucle.
- L'upload de pièces jointes passe par `/api/upload-files` vers un bucket S3 Scaleway et non par le disque local ; un échec S3 se manifeste par un fichier vide, pas par une erreur bloquante.
