# ADR-001 — Next.js App Router

**Date** : 2024  
**Statut** : Accepté

## Contexte

Administration+ est une application full-stack nécessitant un rendu côté serveur pour les données sensibles, une gestion fine des layouts imbriqués (bandeau, navigation, contenu), et une bonne performance initiale (pas de SPA pure). Le projet doit aussi intégrer le DSFR (système de design de l'État français) qui suppose un rendu HTML stable.

## Décision

Utilisation de **Next.js 16 avec l'App Router** (React Server Components), à la place du Pages Router historique de Next.js.

## Justification

- **React Server Components** : les données sensibles (signalements, profils) sont chargées côté serveur, sans exposition au client. Réduit la surface d'attaque XSS.
- **Layouts imbriqués** : le découpage `(private)` / `(public)` avec leurs layouts respectifs est natif avec l'App Router (impossible avec le Pages Router sans duplication).
- **Streaming et Suspense** : chargement progressif des pages lourdes (liste des signalements, dashboard admin).
- **`output: "standalone"`** : compatible avec le déploiement containerisé sur Scalingo.
- **Route Groups** : séparation propre entre routes authentifiées et publiques sans impact sur les URLs.

## Conséquences

- Les composants doivent être explicitement marqués `'use client'` dès qu'ils utilisent des hooks ou des événements navigateur. La règle est : server par défaut, client uniquement si nécessaire.
- Les appels tRPC depuis les Server Components passent par `trpcCaller` (caller serveur), pas par le hook `useTRPC` réservé aux Client Components.
- L'utilisation de `useEffect` est à éviter sauf pour les initialisations navigateur (Matomo, Zammad, DSFR).
