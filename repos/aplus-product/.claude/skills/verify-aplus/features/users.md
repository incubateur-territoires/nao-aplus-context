# Utilisateurs et supervision

L'annuaire liste les utilisateurs visibles par le compte connecté avec leurs équipes, leurs territoires et leur rôle. Il porte les actions du cycle de vie d'un compte : inviter, relancer, modifier, désactiver, réactiver, et promouvoir en superviseur.

## Sub-features

- `users-list` affiche l'annuaire avec équipes, territoires et rôle.
- `users-search` filtre à la saisie sur le nom et l'adresse e-mail.
- `users-sort` trie par nom et par rôle.
- `users-pending` distingue les invitations en attente des comptes actifs.
- `users-resend` relance une invitation non consommée.
- `users-cancel-invite` annule une invitation en attente.
- `users-edit` modifie un utilisateur depuis `/utilisateurs/modifier/<userId>`.
- `users-deactivate` désactive un compte après un aperçu des conséquences.
- `users-reactivate` réactive un compte désactivé.
- `users-to-supervisor` transforme un utilisateur en superviseur après aperçu.
- `users-create-supervisor` crée directement un superviseur.
- `profile-self` modifie son propre profil et ses préférences de notification.

## How to get to it (user POV)

- Choisir `Utilisateurs` dans le menu principal, ou ouvrir `/utilisateurs`.
- Choisir la modification d'une ligne pour ouvrir `/utilisateurs/modifier/<userId>`.
- Ouvrir `/utilisateurs/creer-un-superviseur`.
- Choisir son nom dans l'en-tête pour ouvrir `/mon-profil`.

## Driving it with agent-browser

Préconditions :

- Session posée sur un compte `user` pour l'annuaire, sur un compte `admin` avec 2FA active pour la création de superviseur.
- Les mutations touchent des comptes de staging réels. Les e-mails partent mais les destinataires de `User` sont des puits — **sauf pour les invitations** : lancer `aplus-verify mailrisk` avant d'exercer `users-resend`.

- **Lister.** Lancer `agent-browser open http://localhost:3000/utilisateurs` puis `agent-browser wait --load networkidle`. Le titre de niveau 1 est `Utilisateurs`. Les colonnes sont `Nom du membre / Adresse e-mail`, `Équipe(s)`, `Territoire(s)`, `Rôle / Profession`, `Action`.
- **Rechercher.** `agent-browser focus "#search-users input"` puis `agent-browser keyboard type '<terme>'` (`#search-users` seul est le wrapper DSFR, et `click`/`type` n'y posent pas le focus). Le tableau se réduit aux lignes correspondantes, accents et casse ignorés, et l'URL porte `u_q=<terme>` après ~300 ms (état géré par `useUrlTableState`, comme la recherche de `/equipes`).
- **Trier.** Choisir `Trier par ordre alphabétique inversé` sur la colonne des noms, puis `Trier par ordre croissant` sur la colonne des rôles. L'ordre change entre deux `snapshot`.
- **Comptes désactivés.** Repérer une ligne portant un bouton `Réactiver` : c'est un compte désactivé. Sa présence dans l'annuaire est normale.
- **Aperçu avant désactivation.** Déclencher la désactivation d'un compte. `user.previewDeactivation` s'exécute avant `user.deactivateUser` et affiche les conséquences. Prouver que l'aperçu seul ne modifie rien : `aplus-verify sql "select \"isInactive\" from \"User\" where email = '<email>';"` renvoie toujours `NULL` après ouverture de l'aperçu.
- **Profil personnel.** Ouvrir `/mon-profil`. Les titres de niveau 2 sont `Identifiants de connexion`, `Informations personnelles`, `Notifications par e-mail`, `Équipes`. L'adresse e-mail et le mot de passe sont en lecture seule ; `Prénom` et `Nom` sont requis. Modifier `Profession (optionnel)` avec `type` sur sa référence. **Le clic sur `Enregistrer les modifications` ne soumet pas** : utiliser `agent-browser eval 'document.querySelector("form").requestSubmit()'`. Le log serveur contient alors `user.updateProfile` en `200` et l'alerte `Les modifications ont bien été enregistrées.` apparaît.
- **Preuve de la mise à jour.** Vérifié de bout en bout : `aplus-verify sql "select profession from \"User\" where email = '<email>';"` renvoie la valeur saisie. Attention, la colonne s'appelle `profession`, pas `job`. Restaurer la valeur d'origine après le test.
- **Preuve UI.** Lancer `agent-browser screenshot "$PWD/.claude/skills/verify-aplus/evidence/annuaire.png"` avec le filtre appliqué visible.

## Gotchas

- `supervisor.createSupervisor` et `supervisor.updateSupervisor` sont des procédures admin. Un compte `admin` étant forcé sur `/configurer-2fa` tant que la 2FA n'est pas active, ces chemins sont inatteignables sans passer d'abord la 2FA : le signaler comme précondition non remplie plutôt que comme absence de fonctionnalité.
- **`user.resendInvitation` est le seul flux qui peut atteindre une vraie personne.** `PendingUser` contient des adresses non anonymisées, dont au moins une `@anct.gouv.fr`. Vérifier la cible avec `aplus-verify mailrisk` avant de relancer une invitation ; choisir une ligne dont le domaine est un puits.
- La désactivation et la transformation en superviseur ont chacune une procédure d'aperçu. Vérifier l'aperçu **et** l'exécution.
- La désactivation prend un instantané des équipes du compte dans `DeactivatedUserTeamSnapshot` pour permettre la réactivation. Une réactivation ne restaure pas forcément un rattachement créé après la désactivation.
- `user.getAllUsersForDev` est une procédure **publique** utilisée par le widget d'impersonation ; elle ne renvoie des comptes que quand `APP_ENVIRONMENT` vaut `local` ou `staging`. Ne pas s'en servir pour prouver le contenu de l'annuaire, qui a son propre périmètre.
- L'annuaire ne montre que le périmètre du compte connecté. Comparer deux comptes avant de conclure à une donnée manquante.
