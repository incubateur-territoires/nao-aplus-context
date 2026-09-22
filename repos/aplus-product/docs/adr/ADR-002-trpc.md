# ADR-002 — tRPC pour l'API interne

**Date** : 2024  
**Statut** : Accepté

## Contexte

L'application nécessite une API entre les Server Actions / Client Components et la base de données. Les options envisagées étaient : REST classique, GraphQL, Server Actions Next.js natifs, ou tRPC.

## Décision

Utilisation de **tRPC v11** avec **TanStack Query v5** pour toute la communication client ↔ serveur interne.

## Justification

- **Typage bout en bout** : les types des inputs et outputs des procédures sont inférés automatiquement côté client via `inferRouterOutputs<AppRouter>`. Aucun schéma OpenAPI ni génération de code à maintenir.
- **Validation intégrée** : chaque procédure déclare son schéma Zod. La validation est exécutée côté serveur avant toute logique métier.
- **Cohérence** : un seul pattern pour toutes les interactions (requêtes, mutations, invalidation de cache), contre la dispersion que créent les Server Actions mélangées à du fetch REST.
- **TanStack Query** : gestion native du cache, des états `isLoading`/`isError`, des optimistic updates et de l'invalidation par `queryKey`.
- **Pas de surface REST exposée** : réduit la surface d'attaque. Les procédures ne sont pas accessibles sans passer par le contexte tRPC (session vérifiée dans `protectedProcedure`).

## Conséquences

- Toute nouvelle fonctionnalité nécessite un router tRPC dans `src/trpc/routers/`, pas de route API REST ad hoc.
- Les Server Components utilisent `trpcCaller` (caller serveur direct, sans HTTP).
- Les Client Components utilisent le hook `useTRPC()` + `useQuery`/`useMutation` de TanStack Query.
- L'endpoint HTTP `/api/trpc/[trpc]` est présent mais uniquement consommé par le client tRPC, jamais appelé manuellement.
