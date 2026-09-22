# CLAUDE.md

Guide pour les agents travaillant sur ce dépôt. Ce fichier ne décrit que ce qui ne se lit pas d'un coup d'œil dans le code. Les inventaires vivent dans les sources pointées ici, pas dans ce fichier.

## Le dépôt est public

Ce dépôt est en open source sur GitLab, en `visibility: public`. **Tout ce qui est poussé est publié**, et pas seulement le code : les messages de commit, les titres et descriptions de merge request, les commentaires, les skills sous `.claude/`, la documentation. Un audit de sécurité, un journaliste ou n'importe qui peut les lire, aujourd'hui ou dans cinq ans. Une suppression de branche n'efface rien de façon garantie.

Trois conséquences pratiques, dans l'ordre où on les oublie.

**Ne jamais nommer l'infrastructure.** Pas de nom d'hôte ni de nom de base (`administrat_xxx`), pas de nom de bucket, pas d'URL interne, pas d'identifiant de projet Scalingo, ni dans le code, ni dans un message de commit, ni dans une description de MR. Décrire le contrôle effectué, pas la machine sur laquelle il a tourné : écrire « vérifié que la base visée était bien le staging » et non le nom de cette base.

**Ne jamais publier de données réelles.** Ni citoyen, ni agent, ni adresse e-mail d'une personne. Cela vaut pour les fixtures de test, les exemples de documentation et les captures d'écran. Les preuves de vérification restent dans `.claude/skills/verify-aplus/evidence/`, qui est ignoré par git : les y laisser.

**Border tout outil détournable.** Un script qui touche à l'authentification, aux données ou à la production doit porter des refus durs dans le code, pas une consigne en commentaire. Le cas de référence est `aplus-verify` : il refuse de se connecter si `DATABASE_URL` vise la production, et refuse de franchir un second facteur pour une adresse qui n'est pas un puits. Le raisonnement se documente dans le fichier, pour que la prochaine relecture sécurité trouve la réponse sans avoir à la demander.

Dans le doute sur une description de MR ou un message de commit, retirer le détail. Il n'apporte presque jamais autant que ce qu'il coûte.

## La production ne se touche pas sans accord

**Demander avant toute action visant la production**, y compris une lecture, et sans détailler ici par quels moyens on l'atteindrait. Le staging est le terrain de vérification par défaut ; ses écritures sont partagées avec l'équipe, ce qui se dit avant de l'écrire massivement.

**Ne jamais lancer un script contre la production pour vérifier qu'il refuse de s'y exécuter.** Un refus dur ne se prouve pas en le déclenchant : si la garde est correcte on n'apprend rien, et si elle est cassée — condition inversée, variable mal nommée — le script s'exécute pour de bon sur des données qu'aucune sauvegarde ne rend équivalentes. Le corpus d'annotation du golden dataset, les signalements et les comptes citoyens sont dans ce cas.

La bonne preuve est un test unitaire sur la fonction pure qui décide du refus, exercée avec un environnement simulé. Écrire cette décision dans un module testable (`src/utils/`) plutôt qu'en ligne dans le script, pour qu'elle puisse l'être.

## Le service

Administration+ débloque des situations administratives complexes ou urgentes. Un **aidant** (France Services, travailleur social, agent de mairie) crée un **signalement** décrivant la situation d'un **citoyen**, et l'adresse à des **équipes opératrices** (CAF, CPAM, France Travail, DGFIP…) compétentes sur un **territoire**. Ces équipes répondent dans un fil d'échanges et font avancer le signalement : `PENDING_ASSIGNMENT` → `IN_TREATMENT` → `COMPLETED` ou `CLOSED`.

Un utilisateur porte un `role` (`user`, `supervisor`, `admin`) et appartient à des `Team`, rattachées à une `Organization` et à des `Area`. Le `TeamType` décide qui peut créer et qui doit répondre. Le vocabulaire du domaine fait foi : `prisma/schema.prisma`.

## Stack

Next.js 16 (App Router), TypeScript strict, PostgreSQL via Prisma, tRPC avec superjson, better-auth, DSFR (`@codegouvfr/react-dsfr`) avec MUI et Tailwind, react-hook-form et Zod, TanStack Query, Jest et React Testing Library. Node est épinglé dans `engines`.

**Bun est le gestionnaire de paquets.** Ne pas utiliser npm ou yarn.

```bash
bun install
bun dev                 # http://localhost:3000
bun run check           # TypeScript
bun run lint            # ESLint
bun run test            # Jest ; ajouter un chemin, --testNamePattern, --watch ou --onlyChanged
bun run format          # Prettier
bunx prisma migrate dev # migrations
bunx prisma generate
```

## Repères

- L'alias `@/` pointe `src/`.
- Les groupes de routes portent l'authentification : `src/app/(private)` exige une session, `src/app/(public)` non. La garde est dans `src/proxy.ts`, qui liste aussi les chemins publics.
- `src/generated/prisma` est généré et exclu de TypeScript. Ne jamais l'éditer.
- Les composants d'interface viennent du DSFR. Chercher dans https://github.com/codegouvfr/react-dsfr avant d'écrire du markup.

Pour tout inventaire, lire la source plutôt que ce fichier : les routeurs tRPC dans `src/trpc/routers/_app.ts`, les hooks dans `src/app/hooks/`, les utilitaires dans `src/utils/`, les factories de test dans `src/test/mocks/index.ts`, les routes nommées dans `src/app/constant/route.ts`. **Vérifier `src/utils/` avant d'écrire un helper** : `normalizeSearchQuery` et les formateurs de date existent déjà.

## tRPC : précharger puis hydrater

Les pages sont des Server Components qui **préchargent** les données, puis les passent au client par une frontière d'hydratation. Les composants clients relisent les mêmes requêtes depuis le cache, sans second aller-retour.

Côté page :

```typescript
import { trpc, prefetch } from "@/trpc/server";
import { HydrateClient, getQueryClient } from "@/trpc/hydrate-client";

const queryClient = getQueryClient();
await queryClient.fetchQuery(trpc.report.getReportById.queryOptions(id));
prefetch(trpc.report.getRecipientsByReportId.queryOptions({ reportId: id }));
return <HydrateClient>{children}</HydrateClient>;
```

Utiliser `fetchQuery` quand la page a besoin de la valeur pour décider (`notFound`, `forbidden`, métadonnées), et `prefetch` quand elle se contente de remplir le cache.

Côté composant client :

```typescript
const trpc = useTRPC();
const { data } = useQuery(trpc.report.getReportById.queryOptions(id));
const mutation = useMutation(
  trpc.report.create.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report"] }),
  }),
);
```

**Ne pas utiliser `trpc.x.y.useQuery()`** : aucun fichier du dépôt ne le fait, et cette forme casse le partage de cache avec le préchargement. C'est `queryOptions` qui fait la clé commune entre les deux côtés.

`src/trpc/server-caller.ts` exporte `serverClient`, qui n'est utilisé nulle part. Ne pas s'en servir sans avoir décidé de l'adopter.

Les types se dérivent du routeur, jamais à la main : `inferRouterOutputs<AppRouter>`.

## Conventions

- Le mot-clé `function` pour toute fonction nommée. Les fonctions fléchées sont réservées aux callbacks inline.
- `interface` plutôt que `type`. Pas d'`enum`, utiliser des objets constants. Jamais d'`any`. Les types partagés vont dans `src/types/`.
- Un composant est un dossier contenant un fichier et son `.spec.tsx`. Pas d'utilitaires, de types ni de helpers dans ce dossier : ils vont dans `utils/`, `hooks/` ou `types/`.
- Dossiers en minuscules avec tirets. Exports nommés.
- Privilégier les Server Components et limiter `'use client'`. Récupérer les données côté serveur et les passer en props. Éviter `useEffect` hors API navigateur et initialisation de bibliothèque tierce.
- Pour tout ce qui touche aux performances React ou Next, suivre le skill `react-best-practices` (`.claude/skills/react-best-practices/`). Ce sont les règles de Vercel Engineering, versionnées ici pour que chacun les ait. Elles font autorité sur le rendu, le découpage de bundle, la récupération de données et les re-rendus.
- Les tests sont colocalisés avec le composant. `src/test/setup.ts` installe déjà les mocks de tRPC, react-query et `next/navigation`.

## Prouver avant de dire que c'est fait

`bun run check`, `bun run lint` et `bun run test` passent. Puis exercer le comportement modifié dans l'application réelle.

Le skill `verify-aplus` (`.claude/skills/verify-aplus/`) sert à ça : il lance l'app, authentifie un compte et pilote un parcours dans un vrai navigateur.

```bash
.claude/skills/verify-aplus/scripts/aplus-verify launch
.claude/skills/verify-aplus/scripts/aplus-verify doctor
.claude/skills/verify-aplus/scripts/aplus-verify users user
.claude/skills/verify-aplus/scripts/aplus-verify login <email>
.claude/skills/verify-aplus/scripts/aplus-verify cleanup
```

Sa carte `features/README.md` donne une fiche par parcours, avec les sélecteurs réels et les pièges. La lire avant de piloter l'app. **Cette carte se maintient au moment où l'on sait** : un changement qui modifie un parcours met à jour la fiche concernée dans le même changement, et tout piège rencontré en vérifiant s'y consigne le jour même — pas dans un passage de documentation ultérieur qui n'aura pas lieu.

Trois pièges y coûtent le plus de temps. Le développement local tourne sur la **base de staging**, donc les écritures sont partagées. Les **e-mails partent réellement** même en local, sans garde d'environnement ; `aplus-verify mailrisk` dit qui peut vraiment les recevoir. Enfin un clic qui n'atteint pas sa cible ne le signale pas : utiliser `aplus-verify click` pour les boutons d'action, et juger sur l'effet observable.

Quand un test échoue, remonter à la cause. Adapter le test au code n'est légitime que si le comportement attendu a délibérément changé, et cela se dit dans le message de commit.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
