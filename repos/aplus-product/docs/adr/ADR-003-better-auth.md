# ADR-003 — better-auth pour l'authentification

**Date** : 2024  
**Statut** : Accepté

## Contexte

Le service nécessite une authentification robuste avec : inscription sur invitation uniquement, 2FA TOTP obligatoire pour certains rôles, impersonification admin, gestion de sessions persistantes, et rate limiting. L'alternative principale était NextAuth (Auth.js).

## Décision

Utilisation de **better-auth v1.6** avec l'adaptateur Prisma et le plugin `twoFactor`.

## Justification

- **Inscription sur invitation** : better-auth permet de bloquer l'inscription ouverte et de conditionner la création de compte à la présence d'un `PendingUser` en base. NextAuth ne gère pas ce cas nativement.
- **2FA TOTP natif** : le plugin `twoFactor` de better-auth intègre TOTP (RFC 6238), codes de secours (10 codes hashés), et la vérification en une seule étape. Implémentation maison évitée.
- **Impersonification admin** : le plugin `admin` expose une session d'impersonification bornée à 1h avec le champ `impersonatedBy` tracé en base.
- **Argon2** : hashage des mots de passe par défaut avec argon2id (meilleur que bcrypt pour la résistance aux attaques GPU).
- **Rate limiting intégré** : le plugin rate-limit de better-auth s'appuie sur Redis (ou fallback mémoire), sans dépendance externe supplémentaire.
- **Stockage secondaire Redis** : les sessions peuvent être stockées dans Redis (`@better-auth/redis-storage`) pour une révocation immédiate et une scalabilité horizontale, avec fallback gracieux si Redis est indisponible.

## Conséquences

- Le handler `POST /api/auth/[...all]` est le point d'entrée unique pour sign-in, sign-up, sign-out, reset-password, TOTP.
- Les tables `Session`, `Account`, `TwoFactor`, `Verification` sont gérées par better-auth et ne doivent pas être modifiées directement.
- La rotation du `BETTER_AUTH_SECRET` invalide toutes les sessions actives.
- En cas d'indisponibilité Redis, le rate limiting bascule sur un store en mémoire (non partagé entre instances) — comportement à monitorer en production.
