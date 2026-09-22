# Administration+

Service numérique de l'État permettant de résoudre des **blocages administratifs complexes ou urgents**. Il met en relation des aidants (travailleurs sociaux, agents France Services) avec des opérateurs (Caf, CPAM, DDFIP, MSA…) pour débloquer rapidement des situations personnelles délicates.

Opéré par l'[Agence Nationale de la Cohésion des Territoires (ANCT)](https://www.anct.gouv.fr/) dans le cadre de [beta.gouv.fr](https://beta.gouv.fr/startups/aplus.html).

**Production** : [aplus.beta.gouv.fr](https://aplus.beta.gouv.fr)

---

## Stack technique

| Couche            | Technologie                                   |
| ----------------- | --------------------------------------------- |
| Framework         | Next.js 16 (App Router)                       |
| Langage           | TypeScript strict                             |
| Base de données   | PostgreSQL + Prisma                           |
| API interne       | tRPC v11 + TanStack Query v5                  |
| Authentification  | better-auth (2FA TOTP, invitation uniquement) |
| Système de design | DSFR (`@codegouvfr/react-dsfr`)               |
| CSS               | Tailwind CSS                                  |
| Stockage fichiers | Scaleway Object Storage (SSE-C AES256)        |
| Email             | Brevo                                         |
| Monitoring        | Sentry (instance ANCT)                        |
| Hébergement       | Scalingo (France)                             |
| Runtime           | Node.js 22.12.0 / Bun                         |

---

## Installation

**Prérequis** : Node.js 22.12.0, Bun, PostgreSQL 14+

```bash
# Cloner et installer
git clone https://github.com/betagouv/administration-plus.git
cd administration-plus
bun install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs locales

# Initialiser la base de données
bunx prisma migrate dev
bun run init-db

# Lancer
bun dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

---

## Commandes

```bash
bun dev              # Serveur de développement
bun run build        # Build de production
bun run check        # Vérification TypeScript
bun run lint         # ESLint
bun run format       # Formatage Prettier
bun run test         # Tests unitaires (Jest)
bunx prisma migrate dev   # Nouvelle migration
bunx prisma generate      # Régénérer le client Prisma
```

---

## Architecture

```
src/
├── app/
│   ├── (private)/     # Routes authentifiées (signalements, équipes, profil)
│   ├── (public)/      # Routes publiques (connexion, CGU, statistiques)
│   ├── api/           # Routes API (tRPC, auth, upload, export, cron)
│   └── component/     # Composants partagés
├── trpc/
│   ├── routers/       # Routers tRPC (report, user, team, organization…)
│   └── init.ts        # Contexte tRPC et procédures de base
├── lib/               # Clients partagés (prisma, auth, redis)
├── types/             # Types TypeScript partagés
└── utils/             # Fonctions utilitaires
```

La documentation d'architecture complète est disponible dans [`docs/DAT.md`](./docs/DAT.md).  
Les décisions d'architecture sont dans [`docs/adr/`](./docs/adr/).

---

## Contribuer

Voir [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Pour signaler une vulnérabilité de sécurité : voir [`SECURITY.md`](./SECURITY.md) — ne pas ouvrir d'issue publique.

---

## Licence

[AGPL-3.0](./LICENSE) — Administration+, ANCT / beta.gouv.fr
