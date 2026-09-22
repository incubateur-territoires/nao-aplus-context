# ADR-004 — Prisma + PostgreSQL

**Date** : 2024  
**Statut** : Accepté

## Contexte

Le service gère des données structurées avec des relations complexes (signalements, équipes, organisations, zones géographiques, historiques de statuts). Une couche ORM est nécessaire pour maintenir la cohérence du schéma, gérer les migrations, et offrir un typage TypeScript des entités.

## Décision

Utilisation de **Prisma** comme ORM sur **PostgreSQL** (add-on Scalingo).

## Justification

- **Migrations versionnées** : `prisma migrate dev` / `prisma migrate deploy` garantissent un historique de schéma reproductible entre les environnements (local, staging, production).
- **Typage généré** : le client Prisma généré (`src/generated/prisma`) offre un typage strict de toutes les entités et relations, sans `any`.
- **Extension `unaccent`** : PostgreSQL permet la recherche insensible aux accents via `unaccent()`, essentiel pour les recherches sur les noms de citoyens et les zones géographiques françaises.
- **Scalingo PostgreSQL** : add-on managé, sauvegardes automatiques, connexion SSL, compatible avec les contraintes de souveraineté données (hébergement France).
- **Transactions natives** : Prisma expose `prisma.$transaction()` pour les opérations atomiques (ex. création d'un signalement + historique de statut initial).

## Conséquences

- Le client Prisma est généré dans `src/generated/prisma/` (exclu du contrôle de type TypeScript via `tsconfig.json`, inclus dans `serverExternalPackages`).
- Toute modification du schéma passe par `prisma/schema.prisma` + `bunx prisma migrate dev`.
- Les migrations doivent être exécutées avant chaque déploiement (`bunx prisma migrate deploy`).
- La vue matérialisée `analytics.v_report_fact` (schéma `analytics`) est gérée hors Prisma, via des migrations SQL manuelles.
