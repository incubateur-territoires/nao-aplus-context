# Dossier d'Architecture Technique — Administration+

**Version** : 1.0  
**Date** : juin 2026  
**Statut** : Publié

---

## 1. Présentation du service

Administration+ est un service numérique de l'État permettant de résoudre des blocages administratifs complexes ou urgents. Il met en relation des **aidants** (travailleurs sociaux, agents France Services, superviseurs) avec des **opérateurs** (Caf, CPAM, DDFIP, MSA…) pour débloquer rapidement des situations personnelles délicates.

Le service est opéré par l'**Agence Nationale de la Cohésion des Territoires (ANCT)** et hébergé sur l'infrastructure cloud souveraine **Scalingo**.

**URL de production** : `https://aplus.beta.gouv.fr`

---

## 2. Architecture générale

Administration+ suit une architecture **monolithique modulaire** (Next.js full-stack), sans séparation backend/frontend en services distincts. La logique applicative est centralisée dans un seul dépôt et une seule image déployée.

```
┌─────────────────────────────────────────────────────┐
│                     Navigateur                      │
│          React (RSC + Client Components)            │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│               Next.js 16 (App Router)               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Pages RSC   │  │  API Routes  │  │ tRPC API  │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│  ┌──────────────────────────────────────────────┐   │
│  │          Better Auth (sessions, 2FA)         │   │
│  └──────────────────────────────────────────────┘   │
└───────────┬──────────────────────────┬──────────────┘
            │                          │
┌───────────▼──────────┐  ┌───────────▼──────────────┐
│  PostgreSQL (Prisma) │  │       Redis (ioredis)    │
│  Scalingo add-on     │  │  Sessions + rate limiting│
└──────────────────────┘  └──────────────────────────┘
```

### Services tiers

| Service              | Usage                        | Fournisseur                                |
| -------------------- | ---------------------------- | ------------------------------------------ |
| Object Storage       | Stockage des pièces jointes  | Scaleway S3                                |
| Email transactionnel | Notifications et invitations | Brevo                                      |
| Monitoring / APM     | Erreurs et traces            | Sentry (ANCT auto-hébergé)                 |
| Analytique           | Statistiques d'usage         | Matomo (beta.gouv.fr) + PostgreSQL interne |
| Notifications équipe | Alertes internes             | Mattermost (webhook)                       |
| Support              | Chat aidants                 | Zammad (ANCT)                              |

---

## 3. Stack technique

| Couche                  | Technologie                   | Version |
| ----------------------- | ----------------------------- | ------- |
| Runtime                 | Node.js                       | 22.12.0 |
| Gestionnaire de paquets | Bun                           | —       |
| Framework web           | Next.js (App Router)          | 16      |
| Langage                 | TypeScript (strict)           | —       |
| ORM                     | Prisma                        | —       |
| Base de données         | PostgreSQL                    | —       |
| Cache / sessions        | Redis (ioredis)               | —       |
| API interne             | tRPC v11 + TanStack Query v5  | —       |
| Authentification        | better-auth v1.6              | —       |
| Système de design       | @codegouvfr/react-dsfr (DSFR) | —       |
| CSS                     | Tailwind CSS                  | —       |
| Formulaires             | react-hook-form + Zod         | —       |
| Tests unitaires         | Jest + React Testing Library  | —       |
| Monitoring              | @sentry/nextjs v10            | —       |
| Conteneurisation        | Docker (mode `standalone`)    | —       |
| Hébergeur               | Scalingo                      | —       |

---

## 4. Modèle de données

Le schéma est défini dans `prisma/schema.prisma`. La base de données utilise l'extension PostgreSQL `unaccent` pour les recherches textuelles normalisées.

### Entités principales

```
Organization (organisme)
└── Team (équipe)
    └── User (utilisateur)

Area (zone géographique, code INSEE)
├── Team[]
└── Supervisor[]

Report (signalement)             ← entité centrale
├── author: User
├── coAuthors: User[]
├── applicantTeam: Team          (équipe aidante)
├── requestedTeam: Team          (équipe opérateur)
├── area: Area
├── Answer[]                     (messages échangés)
│   └── File[]                   (pièces jointes)
├── File[]
└── ReportStatusHistory[]

User
├── Session[]                    (Better Auth)
├── Account[]                    (OAuth / credentials)
└── TwoFactor (TOTP)
```

### Cycle de vie d'un signalement (`ReportStatus`)

```
PENDING_ASSIGNMENT → IN_TREATMENT → COMPLETED
                                 ↘ CLOSED
                   (soft delete) → DELETED
```

### Enums clés

- `TeamType` : `OPERATOR`, `FRANCE_SERVICE`, `HISTORICAL_SOCIAL_WORKER`, `TZNR`, `OTHERS_HELPERS`
- `NotificationFrequency` : `EACH_SOLICITATION`, `TWICE_DAILY`, `ONCE_DAILY`, `NONE`
- `OrganizationRole` : `OPERATOR`, `HELPER`

---

## 5. Authentification et gestion des accès

### Authentification

L'authentification est gérée par **better-auth** (adaptateur Prisma, hashage Argon2).

- Inscription sur **invitation uniquement** (modèle `PendingUser`)
- Sessions cookie : durée 7 jours, `httpOnly`, `SameSite=Lax`
- **2FA** : TOTP 6 chiffres (authentificator), 10 codes de secours
- **Impersonification** (admin uniquement) : durée 1 heure, tracée (`impersonatedBy`)
- **Rate limiting** : Redis (préfixe `rl:`), fallback mémoire si Redis indisponible

### Rôles

Les rôles sont portés par le modèle `User` et le modèle `Supervisor`. La logique d'autorisation est appliquée dans chaque procédure tRPC (via `protectedProcedure`).

### ProConnect

La page de connexion intègre un bouton ProConnect (SSO inter-opérateur État). La configuration OAuth est gérée via better-auth.

---

## 6. Routes applicatives

### Routes publiques (`(public)`)

| URL                                   | Description                               |
| ------------------------------------- | ----------------------------------------- |
| `/accueil`                            | Page d'accueil                            |
| `/connexion`                          | Login email/mot de passe + ProConnect     |
| `/terminer-inscription`               | Finalisation d'inscription sur invitation |
| `/mot-de-passe-oublie`                | Réinitialisation du mot de passe          |
| `/verification-2fa`                   | Vérification TOTP                         |
| `/statistiques`                       | Statistiques publiques                    |
| `/contact`                            | Formulaire de contact                     |
| `/accessibilite`                      | Déclaration d'accessibilité               |
| `/conditions-generales-d-utilisation` | CGU                                       |
| `/mentions-legales`                   | Mentions légales                          |
| `/politique-de-confidentialite`       | Politique de confidentialité              |

### Routes authentifiées (`(private)`)

| URL                          | Description                              |
| ---------------------------- | ---------------------------------------- |
| `/signalement`               | Création d'un signalement (4 étapes)     |
| `/signalement/[id]`          | Détail : messages, réponses, invitation  |
| `/tous-les-signalements`     | Liste paginée des signalements           |
| `/equipes` / `/equipes/[id]` | Gestion des équipes                      |
| `/mon-profil`                | Profil utilisateur, notifications        |
| `/configurer-2fa`            | Activation du 2FA                        |
| `/administration`            | Interface admin (bannières, maintenance) |
| `/utilisateurs`              | Gestion des utilisateurs (admin)         |

### Routes API

| URL                    | Description                             |
| ---------------------- | --------------------------------------- |
| `/api/auth/[...all]`   | Handler Better Auth                     |
| `/api/trpc/[trpc]`     | Endpoint tRPC                           |
| `/api/upload-files`    | Upload S3 (multipart, 10 Mo max)        |
| `/api/files/[id]`      | Téléchargement sécurisé depuis S3       |
| `/api/export/reports`  | Export CSV des signalements             |
| `/api/analytics/batch` | Ingestion événements analytiques        |
| `/api/health`          | Healthcheck                             |
| `/api/cron/*`          | Tâches planifiées (voir §8)             |
| `/monitoring`          | Tunnel Sentry (contourne les bloqueurs) |

---

## 7. API interne (tRPC)

L'API interne est exposée uniquement via tRPC (pas de REST exposé, sauf routes API Next.js spécifiques). Les 11 routers sont combinés dans `src/trpc/routers/_app.ts`.

| Router         | Domaine fonctionnel                   |
| -------------- | ------------------------------------- |
| `report`       | Signalements (CRUD, filtres, statuts) |
| `answer`       | Messages / réponses sur signalement   |
| `user`         | Gestion des utilisateurs              |
| `team`         | Gestion des équipes                   |
| `organization` | Organismes                            |
| `area`         | Zones géographiques (code INSEE)      |
| `supervisor`   | Superviseurs                          |
| `banner`       | Bannières d'information du site       |
| `contact`      | Formulaire de contact                 |
| `cron`         | Déclencheurs de tâches planifiées     |
| `debug`        | Outils de débogage (dev uniquement)   |

Chaque procédure est soit `publicProcedure` soit `protectedProcedure` (vérification de session).

---

## 8. Tâches planifiées (cron)

Les cron jobs sont configurés dans `cron.json` (config native Scalingo) et appelés via des routes API authentifiées (`Authorization: Bearer $CRON_SECRET`). Les horaires de `cron.json` sont en **UTC**.

Les trois traitements lourds (suppression de comptes, fermeture automatique, anonymisation des signalements) sont planifiés de nuit et espacés d'une heure : ils s'exécutent en arrière-plan via `after()` et peuvent durer, il ne faut pas qu'ils se recouvrent ni qu'ils tombent aux heures de forte affluence.

| Endpoint                         | Planification (UTC)   | Description                                                                           |
| -------------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| `/api/cron/reports/overdue`      | Lundi 7h              | Signalements en retard                                                                |
| `/api/cron/users/inactivity`     | Tous les 3 jours, 18h | Détection d'inactivité                                                                |
| `/api/cron/notifications/digest` | Toutes les heures     | Envoi des digests                                                                     |
| `/api/cron/users/deletion`       | Tous les jours, 1h    | Suppression douce des comptes                                                         |
| `/api/cron/reports/auto-close`   | Tous les jours, 2h    | Fermeture automatique                                                                 |
| `/api/cron/reports/deletion`     | Tous les jours, 3h    | Anonymisation + suppression des signalements fermés depuis 6 mois (PII + fichiers S3) |
| `/api/cron/analytics/refresh`    | Toutes les 30 min     | Refresh de la vue matérialisée `analytics.v_report_fact` (page `/statistiques`)       |

---

## 9. Stockage des fichiers

Les pièces jointes sont stockées sur **Scaleway Object Storage** (API compatible S3, région `fr-par`).

- **Chiffrement** : SSE-C AES256 (clé fournie par le client, `SCALEWAY_SSE_ENCRYPTION_KEY`)
- **Taille** : 10 Mo maximum, 10 fichiers par requête
- **Types acceptés** : PDF, images (JPEG/PNG/GIF/WebP/BMP/TIFF), documents Office, ODF, texte/CSV
- **Validation** : magic bytes côté serveur (`file-type`) en plus du Content-Type déclaré
- **Nommage** : `{uuid}-{slug-du-nom-original}`
- **Accès** : les fichiers ne sont jamais exposés publiquement ; le téléchargement passe par `/api/files/[id]` après vérification des droits

---

## 10. Emails transactionnels

Gérés via l'API **Brevo** (`@getbrevo/brevo`). Les templates sont définis dans `src/app/services/email/email.template.ts`.

Cas d'usage : invitation d'un membre, notification de nouveau message, digest de notifications, réinitialisation de mot de passe.

---

## 11. Sécurité

### En-têtes HTTP

Définis dans `next.config.mjs` et appliqués à toutes les routes :

- `Strict-Transport-Security` (HSTS, 2 ans, includeSubDomains, preload) — production uniquement
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Content-Security-Policy` : politique stricte avec allowlist explicite par directive

### CSP notable

- `script-src` : `'self'`, nonce dynamique, Matomo, Sentry tunnel, Zammad
- `frame-src` : `'self'`
- `connect-src` : inclut WebSocket Zammad (`wss://`)
- `upgrade-insecure-requests` en production

### Autres mesures

- Secrets gérés en variables d'environnement Scalingo (pas de secrets en clair dans le dépôt)
- `productionBrowserSourceMaps: false` (pas de source maps exposées en production)
- `removeConsole: true` en production
- `sendDefaultPii: false` dans Sentry
- Rate limiting Redis sur les endpoints d'authentification
- Chiffrement SSE-C des fichiers au repos

---

## 12. Analytique

Deux systèmes complémentaires :

1. **Matomo** (`stats.beta.gouv.fr`) : analytics web standard (pages vues, sessions). Intégré via `@socialgouv/matomo-next`.

2. **Analytique interne** : événements métier stockés dans la table `AnalyticsEvent` (PostgreSQL). Ingestion en batch (queue de 50, flush toutes les 5 s). Vue matérialisée `analytics.v_report_fact` dans le schéma `analytics`, rafraîchie toutes les 30 min et lue par le routeur tRPC `stats` pour la page `/statistiques`.

---

## 13. Tests

| Type                    | Outil                        | Localisation                   |
| ----------------------- | ---------------------------- | ------------------------------ |
| Unitaires / intégration | Jest + React Testing Library | Colocalisés (`*.spec.tsx`)     |
| API (routers tRPC)      | Jest                         | `src/trpc/routers/*.spec.ts`   |
| Bout en bout            | Skill `verify-aplus`         | `.claude/skills/verify-aplus/` |

La vérification bout en bout n'est pas automatisée. Elle passe par le skill `verify-aplus`, qui lance l'application, authentifie un compte et pilote un parcours dans un vrai navigateur.

---

## 14. Déploiement

- **Build** : `next build` → image autonome (`output: "standalone"`)
- **Hébergeur** : Scalingo (PaaS, région France)
- **Branches** : `develop` (staging) → `main` (production)
- **Variables d'environnement** : gérées via l'interface Scalingo (`scalingo env-set`)
- **Migrations** : `bunx prisma migrate deploy` (à exécuter avant chaque déploiement)
- **Logs** : remontés à Sentry (erreurs) et consultables via l'interface Scalingo

---

## 15. Conformité et vie privée

- **RGPD** : données personnelles des citoyens limitées au strict nécessaire ; DPO : ANCT (`dpd@anct.gouv.fr`)
- **RGAA** : déclaration d'accessibilité disponible sur `/accessibilite`
- **CGU** : disponibles sur `/conditions-generales-d-utilisation`
- **Politique de confidentialité** : disponible sur `/politique-de-confidentialite`
- **Incidents** : procédure documentée dans `SECURITY.md` (notification DPO sous 72h si données personnelles impactées)

---

## Contacts

| Rôle                         | Contact                                         |
| ---------------------------- | ----------------------------------------------- |
| Équipe produit               | support@aplus.beta.gouv.fr                      |
| DPO ANCT                     | dpd@anct.gouv.fr                                |
| CERT-FR                      | cert-fr@ssi.gouv.fr                             |
| Signalement de vulnérabilité | security.txt (voir `/.well-known/security.txt`) |
