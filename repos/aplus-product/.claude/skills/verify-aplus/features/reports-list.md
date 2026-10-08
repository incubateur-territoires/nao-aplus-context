# Liste des signalements

La page d'accueil d'un utilisateur connecté liste les signalements de son équipe dans un tableau triable et recherchable, avec des compteurs cliquables par état et un onglet de statistiques d'équipe. C'est le point de départ de presque tous les parcours.

## Sub-features

- `list-open` affiche le tableau des signalements créés par l'équipe de l'utilisateur.
- `list-counters` filtre le tableau depuis les quatre compteurs (en souffrance, en attente, en cours, traités).
- `list-search` filtre à la saisie sur le citoyen, le sujet et l'auteur.
- `list-status-filters` restreint par état via les boutons `En attente de prise en charge`, `En cours de traitement`, `Traité`, `Fermé`.
- `list-scope` restreint aux signalements créés par soi, ou aux seuls signalements en souffrance.
- `list-sort` trie par citoyen, auteur, date de création, date du dernier message.
- `list-unread` marque les signalements comportant des messages non lus (pastille rouge) et les signalements jamais consultés (point bleu `Nouveau signalement`). Un signalement fermé (`CLOSED`) ne porte jamais ni pastille ni point bleu, même s'il reste des messages non lus ou qu'il n'a jamais été consulté.
- `list-open-detail` ouvre le détail d'une ligne.
- `list-team-stats` bascule sur l'onglet `Statistiques de votre équipe`.
- `list-export` exporte le tableau courant en CSV.

## How to get to it (user POV)

- Ouvrir `/tous-les-signalements`, ou choisir `Signalements` dans le menu principal.
- Être redirigé depuis `/` après connexion.

## Driving it with agent-browser

Préconditions :

- Session posée par `aplus-verify login <email>` sur un compte `user` rattaché à une équipe.
- Le compte a au moins un signalement visible ; sinon le tableau affiche un état vide légitime.

- **Ouvrir la liste.** Lancer `agent-browser open $APLUS_BASE_URL/tous-les-signalements` puis `agent-browser wait --load networkidle`. Le titre de niveau 1 est `Tous les signalements`, le titre de niveau 2 `Signalements créés par votre équipe`, et un bouton `Créer un nouveau signalement` est présent.
- **Compteurs.** Relever les quatre boutons nommés `<n> en souffrance, voir le tableau filtré`, `<n> en attente de prise en charge, …`, `<n> en cours de traitement, …`, `<n> traités, …`. Choisir l'un d'eux avec `agent-browser click`. Le nombre de lignes du tableau devient cohérent avec le compteur : lire `agent-browser eval 'document.querySelectorAll("table tbody tr").length'`.
- **Recherche.** Saisir un terme dans la zone `Rechercher — Les résultats se mettent à jour automatiquement lors de la saisie dans le champ.`. Récupérer sa référence puis saisir : `REF=$(agent-browser snapshot -i -c | grep 'textbox "Rechercher' | grep -oE 'ref=e[0-9]+' | head -1 | cut -d= -f2)` puis `agent-browser type "@$REF" '<terme>'`. Avec un terme présent, le tableau ne garde que les lignes correspondantes ; la recherche ignore accents et casse (`normalizeSearchQuery`). Avec un terme absent, le tableau affiche `Aucun signalement ne correspond à vos critères de recherche.` — c'est cette phrase qui prouve le filtrage, pas le nombre de lignes.
- **Filtres d'état.** Choisir le bouton `En cours de traitement`. Toutes les lignes restantes portent l'état correspondant.
- **Périmètre.** Cocher `Voir uniquement les signalements que vous avez créés`, puis `Voir uniquement les signalements en souffrance`. Chaque case réduit le tableau et son effet est cumulatif avec la recherche.
- **Tri.** Choisir le bouton `Trier par ordre chronologique` de la colonne `Création`. L'ordre des dates s'inverse entre deux `snapshot` successifs.
- **Ouvrir un détail.** Choisir le lien de la première ligne. L'URL devient `/signalement/<id>`, avec un `id` en UUID.
- **Statistiques d'équipe.** Choisir l'onglet `Statistiques de votre équipe`. Le panneau correspondant devient sélectionné sans changer d'URL.
- **Export.** Déclencher l'export CSV depuis l'interface, puis confirmer côté serveur avec `grep 'report.exportCsv' /tmp/aplus-verify/$APLUS_PORT/dev-server.log`. Le fichier téléchargé contient une ligne par ligne visible du tableau.
- **Preuve.** Capturer l'état filtré. Lancer `agent-browser snapshot -i` et `agent-browser screenshot "$PWD/.claude/skills/verify-aplus/evidence/liste-filtree.png"`. Les artefacts montrent le filtre actif et le tableau résultant.

## Gotchas

- Le tableau ne montre que le périmètre du compte connecté. Un tableau vide n'est pas une régression tant qu'un autre compte de la même équipe ne voit pas de lignes non plus : contrôler avec `aplus-verify sql "select status, count(*) from \"Report\" group by status;"`.
- Les compteurs et le tableau sont deux requêtes distinctes. Un écart entre les deux est un vrai défaut, pas un artefact de pilotage : le prouver en capturant les deux dans le même `snapshot`.
- La recherche est débouncée. Attendre la stabilisation du tableau plutôt que dormir un temps fixe.
- Un résultat vide laisse **une ligne** dans le tableau, celle qui porte le message d'absence de résultat. `document.querySelectorAll("table tbody tr").length` vaut donc `1` et non `0`.
- `document.querySelector("h1")` renvoie le titre masqué `Paramètres d'affichage` de la modale DSFR. Lire `Tous les signalements` dans `agent-browser snapshot -i`, pas par sélecteur CSS.
- Les boutons de filtre par état ne changent pas de nom accessible une fois actifs. Prouver leur effet par le contenu du tableau, pas par l'état du bouton.
- Les colonnes de délais en jours ouvrés valent `0` et jamais `NULL` : un `0` ne signifie pas « non renseigné ».
- L'export CSV traverse une mutation tRPC et apparaît dans le log serveur ; le fichier seul ne prouve pas que la requête a abouti.
- Sur un compte `admin` ou `supervisor`, le tableau n'affiche pas les valeurs réelles : `report.getMyCreatedReportsTable` et `report.getMyRequestedReportsTable` passent par `maskReportsForRole` (`src/utils/mask-sensitive-data.ts`), qui remplace sujet, identifiants et identité du citoyen par `Sujet (42 caractères)`. Le filtrage reste fait côté serveur sur les vraies valeurs, avant le masquage : le terme cherché ne se lit donc pas dans les lignes retenues. Piloter `list-search` depuis un compte `user`.
- Les deux dernières colonnes de l'export CSV sont nommées `Délais de prise en charge (jours)` et `Délais de clôture (jours)` et portent un nombre de jours décimal arrondi au centième, plus l'ancienne chaîne `Xj et Yh`. Une cellule vide signifie non pris en charge ou non clos — à ne pas confondre avec les colonnes de délais en jours ouvrés ci-dessus, où le vide n'existe pas.
- Un signalement fermé n'est plus jamais « en souffrance » : tous les chemins de clôture remettent `overdueAt` à `null` (`CLOSED_REPORT_DATA` dans `src/utils/report.ts`), y compris ceux qui ne passent pas par la mutation de statut — cron d'auto-clôture, désactivation d'un compte, retrait d'un membre, suppression d'une équipe. L'invariant est que seul un signalement `PENDING_ASSIGNMENT` ou `IN_TREATMENT` peut l'être. Un `CLOSED` compté « en souffrance » est donc un défaut, plus un reliquat de données : les lignes historiques ont été nettoyées par la migration `20260907130000`.
- Sur un compte `supervisor`, l'export CSV n'a plus le même périmètre que le seul territoire : `report.exportCsv` croise territoire **et** organisation (équipe applicante ou destinataire), comme le contrôle d'accès unitaire, plus les signalements dont le compte est auteur ou co-auteur. Un export plus court que le tableau d'un autre écran n'est donc pas forcément une perte de lignes : comparer à périmètre égal avant de conclure. Dérivé du code, à confirmer au prochain passage live.
