# CLAUDE.md — dépôt de contexte nao pour Administration+

## C'est quoi ce dépôt
Le **contexte analytique nao** du produit **Administration+ (A+)**, porté par l'Incubateur des
Territoires (ANCT). Il n'est **pas** du code applicatif : c'est la configuration + la connaissance
métier qu'un agent [nao](https://getnao.io) charge pour répondre à des questions analytiques sur
les données de production d'A+.

Une **instance nao dédiée par produit** est déployée sur Scalingo (voir le dépôt de déploiement
`incubateur-territoires/nao-scalingo`, fichier `DEPLOY-SCALINGO.md`). Cette instance clone CE
dépôt au démarrage via `NAO_CONTEXT_GIT_URL` et charge `nao_config.yaml` + `RULES.md`.

## Contenu
- `nao_config.yaml` — connexion à la BDD A+ (PostgreSQL/Prisma) via `{{ env('APLUS_DB_*') }}`,
  templates de métadonnées, exclusions (tables auth/système et jointures Prisma `_*`), `llm: null`.
- `RULES.md` — contexte métier : acteurs (aidants/opérateurs/citoyens), cycle de vie d'un
  signalement, **modèle de données**, définitions d'indicateurs, et **règles RGPD** (données
  citoyen sensibles à ne jamais exposer).
- `agent/prompts/system.md` — ton par défaut de l'agent sur toutes les surfaces (web, Slack…).
  Étend le prompt nao via `{{ nao_prompt }}` au lieu de le remplacer. Relu à chaque message :
  éditer et pousser suffit, pas besoin de redémarrer l'instance.
- `agent/skills/produit.md`, `agent/skills/tech.md` — les deux registres de réponse,
  déclenchables par `/produit` et `/tech` dans le chat (ou par une formulation qui correspond à
  leur `description`).
- `agent/mcps/mcp.json` — serveur MCP Notion (`https://mcp.notion.com/mcp`). Donne à l'agent un
  accès **direct** à Notion, en lecture et en écriture (lire un ticket, en créer un, commenter).
  Aucun secret dans le fichier : chaque personne s'authentifie en OAuth à sa première
  utilisation, via un bouton « Connect » affiché sous la conversation, et ne voit que ce à quoi
  elle a déjà accès. Les outils activés se pilotent dans *Settings → Agent → MCP servers*,
  groupés en Read-only / Write / Delete — **garder `Delete` désactivé**.
- `databases/` — métadonnées par table générées par `nao sync -p databases` : `columns.md`
  (structure seule, aucune donnée) et `annotations.md`, ce dernier **jamais écrasé** — c'est là
  qu'on met le savoir métier propre à une table. Instantané à régénérer si le schéma A+ change.
- `repos/aplus-product/` — copie du code source d'A+ (GitLab `incubateur-territoires/startups/
  administration-plus/administration-plus`, branche `main`) filtrée par les `include`/`exclude`
  de `nao_config.yaml` : `prisma/` (schéma + migrations), `src/`, `docs/`, `specs/`. **Généré par
  `nao sync`, ne pas éditer à la main.** C'est un snapshot committé : l'instance nao ne clone pas
  ce dépôt elle-même, elle lit ce dossier.

## Le métier en une phrase
A+ est une messagerie sécurisée qui débloque les démarches administratives des citoyens via des
**signalements** (`Report`) créés par des **aidants** et traités par des **opérateurs**
(CAF, CPAM, MSA, CNAV, DGFIP, France Travail…). Entité centrale : `Report` ; délais mesurés via
`ReportStatusHistory` ; territoires via `Area.inseeCode`.

## Pour faire tourner / mettre à jour
- **Connexion à la BDD A+ sur l'app nao Scalingo** (idéalement un utilisateur **lecture seule**
  sur un réplica de la prod A+). Au choix :
  - une seule chaîne : `NAO_DB_URL=postgres://user:pass@host:port/dbname` (décomposée par `bin/web.sh`), ou
  - les variables séparées : `NAO_DB_HOST`, `NAO_DB_PORT`, `NAO_DB_NAME`, `NAO_DB_USER`, `NAO_DB_PASSWORD`.
- **Clé LLM** : configurée dans l'interface de Nao (pas en variable d'environnement).
- Ce dépôt doit rester **public** (clone sans secret par l'instance nao) — il ne contient
  aucune donnée ni identifiant, uniquement de la métadonnée et de la doc.
- Le `nao_config.yaml` doit contenir un `nao_config.yaml` valide à la racine (ou dans le
  sous-dossier pointé par `NAO_CONTEXT_GIT_SUBPATH`).
- **Rafraîchir le code A+** (`repos/aplus-product/`) :
  `nao sync -p repositories:aplus-product`, puis committer. `nao-core` (pip) n'a pas de wheel
  pour macOS < 15 ; via Docker depuis la racine du dépôt :
  ```sh
  docker run --rm -v "$PWD":/ctx -w /ctx \
    -e NAO_DB_HOST=x -e NAO_DB_PORT=5432 -e NAO_DB_NAME=x -e NAO_DB_USER=x -e NAO_DB_PASSWORD=x \
    python:3.12-slim bash -lc 'apt-get update -qq && apt-get install -y -qq git >/dev/null; \
      pip install -q nao-core; nao sync -p repositories:aplus-product'
  ```
  (les variables `NAO_DB_*` factices servent juste à faire passer la validation de la config,
  la BDD n'est pas contactée.)
- **Rafraîchir les métadonnées de base** (`databases/`) : la base est sur le réseau privé
  Scalingo, il faut donc un tunnel ouvert en parallèle. Et `nao-core` réclame trois dépendances
  que la doc ne mentionne pas pour PostgreSQL.
  ```sh
  # terminal 1, à laisser tourner
  scalingo --region osc-secnum-fr1 -a nao-administration-plus-prod db-tunnel NAO_DB_URL --port 10801
  # terminal 2, depuis la racine ; NAO_DB_* dans un fichier local hors dépôt
  docker run --rm -v "$PWD":/ctx -w /ctx --add-host=host.docker.internal:host-gateway \
    --env-file ~/.nao-db.env python:3.12-slim bash -lc \
    'pip install -q nao-core "ibis-framework[postgres]" "psycopg[binary]" packaging; \
     nao sync -p databases'
  ```
  **`exclude_columns` doit rester le miroir exact des `GRANT` posés en base** : nao ne lit pas
  `information_schema`, il documente donc les colonnes révoquées si on ne les liste pas, et
  l'agent écrit ensuite du SQL qui échoue.
- **Notion** : rien à rafraîchir, l'accès est direct via le serveur MCP (`agent/mcps/mcp.json`).
  Chaque personne clique « Connect » une fois, l'autorisation est mémorisée pour son compte.
  On a écarté l'export par lot (`nao sync -p notion`) pour deux raisons : il exige un jeton
  d'intégration au niveau du workspace que l'équipe n'a pas le droit de créer, et il aurait
  rendu public dans ce dépôt tout ce qu'il exporte.

## Conventions d'analyse
Français, concis, agrégats only sur les données personnelles. Voir `RULES.md` pour le détail
des règles RGPD et des définitions d'indicateurs.
