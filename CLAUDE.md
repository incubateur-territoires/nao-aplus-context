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
- `public-schema.sql` — dump `pg_dump` (schéma seul, sans données) servant de référence pour le
  modèle. Snapshot : à régénérer si le schéma A+ évolue (`pg_dump --schema-only`).
- `docs/notion/` — export markdown des pages Notion listées dans `nao_config.yaml`
  (`Startups / Administration +` : Documentation produit, Stratégie). **Généré par `nao sync`,
  ne pas éditer à la main.** Snapshot committé, comme le code A+.
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
- **Rafraîchir les pages Notion** (`docs/notion/`) : même commande avec `-p notion` et
  `-e NOTION_API_KEY=secret_…` (clé d'une intégration interne Notion, à créer sur
  https://www.notion.so/profile/integrations, puis partager chaque page listée avec elle via
  « ⋯ → Connexions »). Sans la clé, `nao sync` ignore Notion sans erreur.
  **Attention** : le dépôt est public, tout ce qui est exporté dans `docs/notion/` le devient
  aussi — ne lister que des pages sans donnée personnelle ni information confidentielle.

## Conventions d'analyse
Français, concis, agrégats only sur les données personnelles. Voir `RULES.md` pour le détail
des règles RGPD et des définitions d'indicateurs.
