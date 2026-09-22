# ADR-006 — Redis pour les sessions et le rate limiting

**Date** : 2024  
**Statut** : Accepté

## Contexte

L'application peut être déployée sur plusieurs instances Scalingo (scalabilité horizontale). Sans stockage partagé des sessions, un utilisateur redirigé vers une autre instance perd sa session. De même, le rate limiting en mémoire n'est pas partagé entre instances.

## Décision

Utilisation de **Redis** (add-on Scalingo, connexion TLS `rediss://`) via **ioredis** pour :

1. Le stockage secondaire des sessions better-auth (préfixe `ba:`)
2. Le rate limiting des endpoints d'authentification (préfixe `rl:`)

## Justification

- **Sessions partagées** : avec `@better-auth/redis-storage`, les sessions sont lisibles par toutes les instances. La révocation d'une session est immédiate sur l'ensemble du cluster.
- **Rate limiting distribué** : les compteurs de tentatives de connexion sont partagés entre instances. Un attaquant ne peut pas contourner le rate limit en forçant des reconnexions sur des instances différentes.
- **Résilience** : le wrapper `resilientSecondaryStorage` (voir `src/lib/redis.ts`) intercepte les erreurs Redis et bascule sur un fallback en mémoire. L'application reste disponible si Redis est indisponible, avec dégradation gracieuse (sessions et rate limit en mémoire locale uniquement).
- **TLS** : la connexion utilise `rediss://` (TLS), obligatoire pour les add-ons Scalingo Redis en production.

## Conséquences

- La variable `SCALINGO_REDIS_URL` est requise en production. L'absence de Redis n'est pas bloquante (fallback mémoire) mais réduit la sécurité du rate limiting.
- En cas de fallback mémoire sur plusieurs instances, le rate limiting n'est plus distribué — surveiller les alertes Redis.
- Le préfixe `ba:` (sessions) et `rl:` (rate limit) permettent de distinguer les usages dans les outils de monitoring Redis.
- La rotation du `BETTER_AUTH_SECRET` invalide les sessions Redis existantes (les clés chiffrées avec l'ancien secret ne sont plus lisibles).
