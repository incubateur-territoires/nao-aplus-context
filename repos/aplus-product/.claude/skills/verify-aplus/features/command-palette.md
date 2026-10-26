# Recherche rapide (⌘K)

Modale réservée aux admins, ouverte par ⌘K (Mac) ou Ctrl+K sur n'importe quelle page. Elle cherche des signalements, des utilisateurs et des équipes, et liste les pages d'administration. Un signalement se trouve par son objet ou par le nom ou l'e-mail de son auteur, **jamais par le nom du citoyen**. Coller un identifiant ou une URL qui en contient un affiche directement l'entité correspondante.

## Sub-features

- `cmdk-open` : ⌘K ou Ctrl+K ouvre la modale, une seconde frappe la referme, Échap aussi.
- `cmdk-pages` : sans saisie, la liste des pages d'administration. Avec une saisie, ces pages sont filtrées côté client, sans tenir compte des accents ni de la casse.
- `cmdk-search` : à partir de 2 caractères, après un délai de 250 ms, `quickSearch.search` renvoie au plus 5 signalements, 5 utilisateurs et 5 équipes. Les signalements affichent l'auteur, la date et un badge de statut.
- `cmdk-id` : un UUID collé, seul ou au milieu d'une URL, cherche cet identifiant parmi les signalements, utilisateurs et équipes, au lieu d'une recherche texte.
- `cmdk-recents` : les 5 dernières entités ouvertes, gardées en `sessionStorage` (`aplus:quick-search:recents`, vidé à la fermeture de l'onglet) sans le statut, apparaissent en tête quand le champ est vide.
- `cmdk-guard` : la modale n'est montée que pour le rôle `admin` (lu côté serveur dans le layout racine), et `quickSearch.search` est une `adminProcedure`.

## How to get to it (user POV)

- Connecté en admin, sur n'importe quelle page : ⌘K ou Ctrl+K.
- Aucun bouton visible : le raccourci est la seule porte d'entrée.

## Driving it with agent-browser

Préconditions :

- Un compte **admin** avec 2FA, à une adresse-puits : `aplus-verify login` sur un admin en `test.mail`. Choisir un admin qui a une ligne `TwoFactor` (jointure `"TwoFactor"."userId"`), car `twoFactorEnabled` seul ne suffit pas à `login`.
- Aucune écriture en base. Seul le `sessionStorage` du navigateur change.

- **Ouvrir.** `agent-browser press Control+k` après `wait --load networkidle` et ≈ 3 s. Le `snapshot` montre un `combobox "Recherche rapide"` et un `listbox "Suggestions"`.
- **Chercher.** `agent-browser type @<ref du combobox> 'caf'`, attendre ≈ 4 s, puis lire les `option` du `snapshot`. La requête se lit dans le log sous la forme `GET /api/trpc/quickSearch.search?…`.
- **Ouvrir un résultat.** `ArrowDown` jusqu'à l'option voulue (marquée `[selected]`), puis `Enter`. La première ouverture d'une page compile en dev, comptez jusqu'à 15 s avant de lire l'URL.
- **Identifiant.** Taper `$APLUS_BASE_URL/signalement/<id>` : une seule option, déjà `[selected]`, et `Enter` ouvre le signalement.
- **Garde.** Connecté en `user`, Ctrl+K n'ouvre rien. `curl -b /tmp/aplus-verify/$APLUS_PORT/session.cookie "$APLUS_BASE_URL/api/trpc/quickSearch.search?batch=1&input=…"` répond `FORBIDDEN` (403).

Vérifié de bout en bout le 2026-10-21 : ouverture, recherche texte, navigation au clavier vers une équipe, récents, identifiant collé, refus pour un compte `user`.

## Gotchas

- Les résultats arrivent après la frappe. Sans sélection contrôlée, cmdk perd la ligne active et Entrée ne fait rien. La palette force donc la première ligne visible dès que la sélection courante disparaît. Le test jsdom ne reproduit pas ce décalage : seul le navigateur le prouve.
- Sur le staging, les e-mails anonymisés sont des UUID : une recherche courte comme `caf` remonte des utilisateurs dont l'adresse contient ces lettres.
- Le rôle est lu dans le layout racine, qui persiste d'une navigation client à l'autre. Juste après une connexion sans rechargement complet, la palette peut manquer jusqu'au prochain rechargement, comme le menu `Administration`.
