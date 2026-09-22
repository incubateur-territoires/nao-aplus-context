# Tests de montée en charge — k6

Suite de tests de performance pour Administration+ utilisant [k6](https://k6.io/).

## Prérequis

```bash
# Installer k6
brew install k6

# Lancer l'application
bun dev
```

Un utilisateur de test doit exister dans la base de données locale (par défaut : `admin@administration-plus.fr` / `Azerty1!`).

## Scénarios

| Scénario           | Description                                  | Commande               |
| ------------------ | -------------------------------------------- | ---------------------- |
| **healthcheck**    | Smoke test — vérifie que l'app répond        | `bun run k6:smoke`     |
| **auth**           | Flux d'authentification complet              | `bun run k6:auth`      |
| **trpc-queries**   | Queries tRPC principales en charge           | `bun run k6:queries`   |
| **trpc-mutations** | Mutations tRPC (réponses, profil)            | `bun run k6:mutations` |
| **user-journey**   | Parcours utilisateur réaliste                | `bun run k6:journey`   |
| **tous**           | Exécution séquentielle de tous les scénarios | `bun run k6:all`       |

## Configuration

Variables d'environnement supportées :

| Variable             | Défaut                         | Description                    |
| -------------------- | ------------------------------ | ------------------------------ |
| `BASE_URL`           | `http://localhost:3000`        | URL de l'application           |
| `TEST_USER_EMAIL`    | `admin@administration-plus.fr` | Email du compte de test        |
| `TEST_USER_PASSWORD` | `Azerty1!`                     | Mot de passe du compte de test |

Exemple avec un environnement de staging :

```bash
k6 run -e BASE_URL=https://staging.example.com -e TEST_USER_EMAIL=test@example.com -e TEST_USER_PASSWORD=secret load-tests/scenarios/healthcheck.js
```

## Profils de charge

Définis dans `config.js`, utilisables dans chaque scénario :

- **smoke** : 1 VU, 30 secondes
- **load** : montée progressive jusqu'à 50 VU
- **stress** : montée jusqu'à 200 VU
- **spike** : pic soudain à 500 VU

## Seuils de performance

Par défaut (modifiables dans `config.js`) :

- **p(95) < 500ms** — 95% des requêtes sous 500ms
- **p(99) < 1500ms** — 99% des requêtes sous 1.5s
- **Taux d'erreur < 1%**

## Structure

```
load-tests/
├── config.js              # Configuration partagée
├── helpers/
│   ├── auth.js            # Login et gestion des cookies
│   └── trpc.js            # Helpers pour appels tRPC batch
├── scenarios/
│   ├── healthcheck.js     # Smoke test
│   ├── auth.js            # Test d'authentification
│   ├── trpc-queries.js    # Queries tRPC en charge
│   ├── trpc-mutations.js  # Mutations tRPC
│   └── user-journey.js    # Parcours utilisateur complet
└── README.md
```

## Notes

- Les tests de mutations créent de vraies données. Utiliser uniquement sur un environnement de test.
- Le rate limiting de better-auth (5 login/15min) peut impacter les scénarios avec beaucoup de VU. Pour les tests de stress, envisager de désactiver le rate limiting ou d'augmenter les limites.
- k6 gère les cookies de session automatiquement par VU via `http.cookieJar()`.
