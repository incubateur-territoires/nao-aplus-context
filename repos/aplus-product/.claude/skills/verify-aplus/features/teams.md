# Équipes

Une équipe rattache des utilisateurs à une organisation et à des territoires. Son type décide de son rôle dans le service : les équipes aidantes créent des signalements, les équipes opératrices y répondent. La page liste les équipes de l'utilisateur et permet d'en créer et d'en administrer une.

## Sub-features

- `teams-list` affiche les équipes auxquelles l'utilisateur appartient.
- `teams-search` (superviseur, admin) filtre le tableau « Toutes les équipes » par nom ou matricule, avec filtres territoire et organisation ; l'état vit dans l'URL (`t_q`, `t_page`, `t_sort`…) via `useUrlTableState`.
- `teams-detail` ouvre la fiche d'une équipe avec ses membres et ses territoires.
- `teams-create` crée une équipe rattachée à une organisation et à des territoires.
- `teams-add-member` rattache un utilisateur à l'équipe.
- `teams-remove-member` détache un membre après un aperçu des conséquences.
- `teams-managers` désigne ou retire un responsable d'équipe.
- `teams-areas` modifie les territoires couverts.
- `teams-registration-number` (admin) modifie le matricule d'une équipe France Services depuis la section « Administration de l'équipe ».
- `teams-accept-types` modifie les types de sollicitation acceptés.
- `teams-delete` supprime une équipe après un aperçu des conséquences.
- `teams-activity` affiche l'activité des membres de l'équipe.

## How to get to it (user POV)

- Choisir `Équipes` dans le menu principal, ou ouvrir `/equipes`.
- Choisir une équipe dans `Vos équipes` pour ouvrir `/equipes/<id>`.
- Choisir la création d'équipe, ou ouvrir `/equipes/creer`.

## Driving it with agent-browser

Préconditions :

- Session posée sur un compte appartenant à au moins une équipe ; un responsable ou un superviseur voit davantage d'actions.
- Pour `teams-create` : être **responsable** d'au moins une équipe (ou admin, ou superviseur). Un simple membre atteint `/equipes/creer` mais la liste `Organisation` y est vide, et la page est alors impraticable sans que rien ne l'annonce.
- Les mutations écrivent dans la base de staging partagée et peuvent retirer de vrais utilisateurs de leur équipe. Les e-mails associés vont vers des adresses puits.

- **Lister.** Lancer `agent-browser open $APLUS_BASE_URL/equipes` puis `agent-browser wait --load networkidle`. Le titre de niveau 1 est `Équipes`, le titre de niveau 2 `Vos équipes`, et chaque équipe apparaît en titre de niveau 3 avec son nom, par exemple `France Services Belle-Isle-en-Terre`.
- **Ouvrir une fiche.** Choisir le nom d'une équipe. L'URL devient `/equipes/<id>` et la fiche liste les membres et les territoires. Pour un admin, sous le titre `Informations de l'équipe`, une ligne `Équipe créée le <date> par <prénom nom>.` ; sans `par …` quand le créateur est inconnu (équipes antérieures à l'événement analytics `team_created`, soit la quasi-totalité).
- **Rechercher (superviseur/admin).** Le champ « Rechercher » du tableau : `agent-browser focus "#search-teams input"` puis `agent-browser keyboard type "<texte>"`. Après ~300 ms de pause, l'URL porte `t_q=<texte>` et le tableau se filtre (relire par `snapshot`). Un deep-link `/equipes?t_q=<texte>` préremplit le champ, et le retour navigateur depuis une fiche restaure recherche et saisie.
- **Créer.** Ouvrir `/equipes/creer`, renseigner le nom, l'organisation et les territoires (`type` sur les références de `snapshot` pour les champs texte), puis valider. La liste `Organisation` vient de `organization.getMyManagedOrganizations` et les territoires de `area.getMyAreas` : toutes deux sont restreintes à ce que le compte **gère**, pas à ce dont il est membre. Le log serveur contient `team.createTeam` et l'URL mène à la nouvelle fiche.
- **Preuve de création.** Relire la ligne : `aplus-verify sql "select id, name, type from \"Team\" order by \"createdAt\" desc limit 1;"`.
- **Ajouter un membre.** Depuis la fiche, ajouter un collègue. Le log serveur contient `team.addUserToTeam` et le membre apparaît dans la liste après rechargement. La réponse de la mutation ne porte que `id` et `email` par compte touché : le jeton d’invitation ne quitte le serveur que par l’e-mail. Vérifié en live le 2026-10-21 sur un compte responsable puits, en observant la réponse réseau.
- **Aperçu avant retrait.** Déclencher le retrait d'un membre. Un aperçu des conséquences s'affiche **avant** confirmation : c'est `team.previewRemoveFromTeam`, distinct de `team.removeUserFromTeam`. L'appel ne part qu'à l'ouverture de la modale : au chargement de la fiche, le log serveur ne doit contenir aucun `previewRemoveFromTeam`, puis exactement un à l'ouverture, pour le membre visé. Vérifier que l'aperçu seul ne modifie rien, par un `snapshot` de la liste des membres avant et après ouverture de l'aperçu.
- **Territoires et types acceptés.** Modifier les territoires puis les types de sollicitation. Le log serveur contient `team.updateTeamAreas` puis `team.updateTeamAcceptTypes`, et la fiche reflète les nouvelles valeurs après rechargement.
- **Matricule (admin).** Sur la fiche d'une équipe dont l'organisation est de type `FRANCE_SERVICE`, la section « Administration de l'équipe » porte un champ `Matricule`, absent pour les autres organisations et pour un superviseur. Vide à l'enregistrement : `Le matricule est obligatoire pour France Services.` sans appel serveur. Autre chose que 1 à 6 chiffres (`ab`) : `Le matricule ne doit contenir que des chiffres (6 au maximum).`, sans appel serveur non plus, et la même règle vaut à la création. Matricule d'une autre équipe : `team.updateTeamAdmin` répond 409 et le message de doublon s'affiche sous le champ. Preuve en base : `aplus-verify sql "select \"registrationNumber\" from \"Team\" where id='<id>';"`, puis remettre la valeur d'origine. Vérifié en live le 2026-10-08, format le 2026-10-12, sur un compte puits.
- **Preuve.** Lancer `agent-browser screenshot "$PWD/.claude/skills/verify-aplus/evidence/equipe-<id>.png"` avec le nom de l'équipe et la liste des membres visibles.

## Gotchas

- Un échec de `team.addUserToTeam` s’affiche sous le formulaire, qui reste utilisable avec ses adresses saisies. Jusqu’au 2026-10-21 il faisait tomber **toute la page** sur l’écran `Réessayer` (rejet non intercepté de `mutateAsync`) : sur une version antérieure, recharger la page avant de rejouer l’action, sans quoi les frappes partent dans le vide sans erreur.
- Deux boutons `Enregistrer les modifications` coexistent sur la fiche : le premier pour « Informations de l'équipe », le second pour « Administration de l'équipe ». `aplus-verify click` par texte prend le premier ; viser le second par `eval` (`[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Enregistrer les modifications')[1].click()`).
- Sélectionner-tout puis `Backspace` ne vide pas de façon fiable un champ prérempli (un caractère reste) : relire la valeur saisie avant de juger le résultat.
- Le menu « Actions pour <membre> » et ses entrées ne réagissent pas à `agent-browser click` : passer par `agent-browser eval` avec `.click()` sur le bouton retrouvé par son `aria-label`, puis sur l'entrée du menu cherchée **dans le `ul` du déclencheur `aria-expanded=true`**. Un `.click()` sur le premier bouton « Retirer de l'équipe » du document tombe sur le pied d'une modale fermée d'une autre ligne.
- `#search-teams` est le **wrapper** DSFR, pas l'input (son id réel est généré). Viser `#search-teams input`. Sur ce champ, `click` et `type` ne posent pas le focus : passer par `focus` puis `keyboard type`, et juger sur `get value` / l'URL.
- La recherche écrit dans l'URL par `router.replace` : pas d'entrée d'historique par frappe. Un `back` juste après une recherche sort de la page au lieu de « défaire » la recherche.
- `team.getTeams` et `team.updateTeamAdmin` sont réservés aux admins ; sur un compte `user` ces chemins sont légitimement absents de l'interface.
- Le type d'équipe est parfois hérité (`team.getManagerInheritedTeamType`) plutôt que choisi. Un type non modifiable n'est pas un champ cassé.
- Les mutations de suppression et de retrait ont chacune une procédure d'aperçu associée. Vérifier l'aperçu **et** l'exécution : confirmer l'aperçu sans exécuter ne prouve rien sur la mutation.
- Retirer un membre écrit un instantané dans `DeactivatedUserTeamSnapshot`. Un retrait de test laisse donc une trace même après réintégration.
- Une équipe supprimée peut porter des signalements existants. Ne pas supprimer une équipe des données de staging pour tester.
- Les règles d'accès à `/equipes/<id>` vivent dans `src/trpc/middleware/authorization.ts`. Lecture (`hasTeamAccess`) : admin toujours ; sinon membre ou responsable ; un superviseur y accède aussi quand l'équipe est dans son périmètre organisation + territoires. Modification (`checkTeamModifyAccess`) : admin, superviseur dans le périmètre, ou responsable de l'équipe. Un superviseur membre d'une équipe hors de son périmètre (cas « pilote national ») voit la fiche comme n'importe quel membre.
- Pour exercer cette garde sans compte idoine, construire le cas par SQL : prendre un superviseur `@test.mail` au périmètre étroit (`aplus-verify sql` sur `Supervisor` et ses jointures), une équipe hors de ce périmètre, prouver le refus, puis `insert into "_TeamToUser" ("A","B") values ('<teamId>','<userId>')` (`A` = équipe, `B` = utilisateur) et prouver l'accès. Supprimer la ligne ensuite : écriture de staging petite et réversible, mais réelle.
- La création d'équipe est bornée des deux côtés, et le côté serveur est le plus strict : `checkManagerCreatesInOwnOrganization` refuse un responsable qui ne gère aucune équipe dans l'organisation visée, avec `Vous ne pouvez créer une équipe que dans une organisation où vous gérez déjà une équipe.` Admins et superviseurs en sont exemptés. Ce refus est le comportement attendu, pas une régression de formulaire. Dérivé du code, à confirmer au prochain passage live.
- Un responsable dont le type d'équipe hérité est `HISTORICAL_SOCIAL_WORKER` ne peut pas créer d'équipe : le bouton `Créer une équipe` disparaît de `/equipes`, `/equipes/creer` affiche l'alerte `Création d'équipe indisponible` à la place du formulaire, et `team.createTeam` répond `403 FORBIDDEN` avec `Les travailleurs sociaux historiques ne peuvent pas créer d'équipe.` Un responsable aux types mixtes garde le formulaire, sans l'option `Travailleurs sociaux historiques`. Admins et superviseurs ne sont pas concernés. Vérifié en live le 2026-10-06 sur un compte puits.
- Le rôle de l'équipe (`OPERATOR` / `HELPER`) n'est plus une entrée du formulaire : il se dérive de l'organisation choisie. Comme lui seul décide de la présence de l'équipe dans les listes d'adressage des signalements, une équipe créée dans une organisation aidante n'apparaîtra jamais comme destinataire — c'est le choix de l'organisation qu'il faut relire, pas un champ manquant.
- La fiche équipe ne reçoit plus que ce qu'elle affiche : `team.getTeamById` ne renvoie aucun signalement des membres, et les responsables comme les invitations en attente n'arrivent qu'en identifiants. Un champ absent de la réponse tRPC n'est donc pas une donnée perdue : c'est la sélection qui s'est resserrée.
- Le tableau des membres n'a plus de colonne `Dernière activité` (retirée le 2026-10-12 : elle ne reflétait que la création de signalements). Ses en-têtes sont `Nom du membre`, `Rôle`, `Activité` et `Action` ; une invitation en attente se reconnaît au badge `En attente` de la colonne `Rôle`, le badge `CGU non acceptées` a disparu avec la colonne. Vérifié en live le 2026-10-12 sur un compte responsable puits.
- Un superviseur qui ouvre la fiche d'une équipe hors de son périmètre voit `Accès refusé`, pas une fiche vide : pour vérifier la fiche, se connecter plutôt en responsable de l'équipe.
- L'aperçu de suppression d'équipe applique désormais le **même** périmètre que la suppression : un superviseur hors périmètre reçoit `Équipe hors de votre périmètre superviseur` dès l'aperçu, plus seulement à la confirmation. Et les signalements qu'il énumère passent par `maskReportsForRole` : sur un compte `admin` ou `supervisor`, les noms de citoyens y apparaissent sous la forme `Nom (12 caractères)`, comme partout ailleurs. Un aperçu aux libellés masqués n'est pas un aperçu cassé. Dérivé du code, à confirmer au prochain passage live.
