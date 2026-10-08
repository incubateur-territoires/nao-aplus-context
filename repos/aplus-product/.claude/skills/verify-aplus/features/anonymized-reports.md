# Signalements anonymisés

Page admin en lecture seule qui liste les signalements pseudonymisés et les libellés posés par le modèle (démarche, blocage). Une seule granularité : les tags de l'équipe (labels fins adjugés en réunion), en badges colorés et en filtres. Les catégories de la liste fermée n'apparaissent nulle part. Seul le texte pseudonymisé est affiché : le texte réel n'est jamais lu par le routeur `anonymizedReport`.

## Sub-features

- `anon-list` liste 20 signalements par page, du plus récent au plus ancien, avec sujet pseudonymisé, badges et date.
- `anon-detail` affiche le signalement sélectionné : sujet, ligne `Équipes destinataires : …` (noms des équipes, ordre alphabétique, masquée si aucune), badges, description, échanges datés à la minute (`05 janvier 2026, 14h25`) et étiquetés `Aidant` ou du nom court de l'opérateur (`CAF`). `Équipe opératrice` ne reste qu'en repli, quand aucune équipe de l'auteur, actuelle ou figée à sa désactivation, n'est destinataire du signalement.
- `anon-filter` restreint la liste, par axe, à un tag de l'équipe, toutes recettes confondues ; un signalement étiqueté plusieurs fois affiche son étiquetage le plus récent. Une graphie stockée qui ne diffère que par la casse ou les accents compte comme le même tag.
- `anon-tagged` masque par défaut les signalements jamais étiquetés ; le décocher les réaffiche.
- `anon-operator` restreint la liste aux signalements dont un destinataire appartient à l'organisation choisie (par nom court : `CAF`, `MDPH`).
- `anon-paginate` navigue entre les pages.

## How to get to it (user POV)

- Menu déroulant `Administration`, puis `Signalements anonymisés`.
- Ou directement `/admin/signalements-anonymises`. Les paramètres `page`, `operateur`, `tous`, `demarche`, `blocage` et `id` pilotent l'état.

## Driving it with agent-browser

Préconditions :

- Session posée sur un compte **admin** avec 2FA : `aplus-verify login` sur un admin en `test.mail`. Tout autre rôle est renvoyé vers `/tous-les-signalements`.
- Aucune écriture : le parcours est sans risque pour les données partagées.

- **Lire la liste.** Le compteur `N signalements` est en tête de la `section` nommée `Liste des signalements`. Chaque ligne est un `link` dont le nom est le sujet suivi de la date. La ligne sélectionnée porte `aria-current="true"`. Sans `id` dans l'URL, c'est la première de la page.
- **Ouvrir un signalement.** Cliquer une ligne ajoute `id=` à l'URL en gardant page et filtres. Le détail est dans la `section` nommée `Signalement sélectionné`, titre de niveau 2 = sujet.
- **Lire les badges.** Au plus un badge par axe, le tag de l'équipe, coloré (bleu démarche, violet blocage). Texte masqué dans l'arbre d'accessibilité : `Démarche :` / `Blocage :` devant chaque badge. Aucun badge de catégorie.
- **Ne garder que les étiquetés.** `checkbox` nommé `Voir uniquement les signalements étiquetés`, au-dessus des menus, **coché par défaut** : sans paramètre, la liste ne montre que les signalements ayant au moins un étiquetage. Le décocher (`scrollintoview` puis `click`) pousse `tous=1`, remet la page à 1, retire `id` et se cumule avec les autres filtres ; le recocher retire le paramètre. Toute autre valeur que `1` est ignorée. Un signalement étiqueté peut rester sans badge : ses tags sont des exutoires (`autre`, `indéterminé`), vides ou absents de la taxonomie actuelle.
- **Filtrer par opérateur.** Premier `combobox`, nommé `Opérateur` : `Tous` (valeur vide), puis les noms courts des organisations ayant au moins une équipe destinataire d'un signalement, par ordre alphabétique (20 en staging au 2026-10-06). La valeur est le nom court ; `select` pousse `operateur=`, remet la page à 1, retire `id` et se cumule avec les deux autres filtres. Pagination et sélection d'une ligne conservent `operateur`.
- **Filtrer par tag.** Deux `combobox` nommés `Démarche` et `Blocage`. Après `Toutes` / `Tous` (valeur vide) viennent à plat les tags de l'équipe rattachés à la liste fermée, dans l'ordre de ses catégories (`aucun` compris côté blocage), puis un `optgroup` de `label` `Autres` qui regroupe les tags créés par l'équipe hors liste (côté blocage : `déménagement`, `formulaire inadapté`). La valeur d'une option est le libellé lui-même. `agent-browser select @ref <libellé>` pousse `demarche=` / `blocage=`, remet la page à 1 et retire `id`. Sans résultat : `Aucun signalement anonymisé ne correspond.`
- Les paramètres portent la graphie exacte (`demarche=demande+rsa`). Une valeur hors liste est ignorée, dont un nom de catégorie (`demarche=RSA`). Les anciennes clés `demarche-categorie` et `blocage-categorie` sont ignorées.
- **Paginer.** Les liens `.fr-pagination__link` portent `href="…?page=N"`. **Le DSFR rend chaque lien de page en double**, dont un masqué : `agent-browser click 'a[href$="page=2"]'` vise le masqué et ne fait rien. Cliquer via `agent-browser eval 'document.querySelector("a[href$=\"page=2\"]").click()'`, ou par la `@ref` d'un `snapshot`.

## Pièges

- **Pas de badges en staging** tant que l'étiquetage n'a pas tourné : au 2026-09-30, la table `ReportTagging` y est vide. Les filtres répondent alors toujours vide. Pour voir les badges, créer quelques lignes `ReportTagging` sous une `recipeKey` factice, vérifier, puis les supprimer par cette même `recipeKey`.
- Sans tag de l'équipe (libellé `null`, `inconnu`, `autre`, ou absent de la projection comme un nom de catégorie `AAH`), l'axe n'a pas de badge : c'est voulu. `aucun` (blocage) a son badge et son option de filtre.
- Les tags que la projection range sous `autre` (ex. `déménagement`) ont leur badge et sont filtrables dans le groupe `Autres`.
- Pour des lignes factices, seules les colonnes `procedureLabel` / `blockageLabel` comptent : badges et filtres ignorent `procedureTag` / `blockageTag`.
- **Premier chargement en erreur** (`Une erreur est survenue`) : la transaction `count` + `findMany` de `list` dépasse parfois 5 s depuis un poste local vers la base distante. Recharger ; ce n'est pas le code de la page.
