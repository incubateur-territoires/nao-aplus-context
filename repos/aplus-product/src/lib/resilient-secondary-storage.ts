import type { SecondaryStorage } from "better-auth";
import * as Sentry from "@sentry/nextjs";

/**
 * Log + remontée Sentry d'une dégradation Redis. Depuis que ce wrapper avale
 * les erreurs, ces incidents ne produisent plus de 500 (donc invisibles via
 * onAPIError) : c'est ici qu'on garde la trace de l'impact fonctionnel réel
 * (session lue/écrite en mode dégradé). Sentry regroupe par `op` → un seul
 * issue avec sa fréquence, pas un flood.
 */
function reportDegradation(op: "get" | "set" | "delete", err: unknown): void {
  console.error(
    `[Redis] secondaryStorage.${op} failed (mode dégradé):`,
    err instanceof Error ? err.message : err,
  );
  Sentry.captureException(err, {
    level: "warning",
    tags: { source: "redis-secondary-storage", op },
  });
}

/**
 * Enveloppe un `SecondaryStorage` better-auth (ici Redis) pour qu'une panne
 * du store ne provoque JAMAIS de 500 sur les routes /api/auth/*.
 *
 * Contexte : `@better-auth/redis-storage` exécute les commandes Redis sans
 * try/catch (`return client.get(...)`, `await client.set(...)`). Lors d'une
 * bascule master/replica, d'un timeout (`commandTimeout`) ou de la fenêtre de
 * reconnexion ioredis ("Connection is closed."), l'exception remonte jusqu'au
 * handler better-auth et devient une erreur 500.
 *
 * ATTENTION : `storeSessionInDatabase` n'étant pas activé, le secondaryStorage
 * est le SEUL lieu de vie des sessions — la table Postgres `session` reste
 * vide, et un `prisma.session.deleteMany` ne révoque rien (utiliser
 * `revokeUserSessions` de `src/utils/auth-server.ts`). La dégradation reste
 * sûre côté sécurité, au prix de la disponibilité :
 *  - `get` renvoie `null` → session introuvable → déconnexion (fail-closed,
 *    pas un 500).
 *  - `set` / `delete` deviennent des no-op le temps de l'incident.
 */
function resilientSecondaryStorage(inner: SecondaryStorage): SecondaryStorage {
  return {
    async get(key) {
      try {
        return await inner.get(key);
      } catch (err) {
        reportDegradation("get", err);
        return null;
      }
    },
    async set(key, value, ttl) {
      try {
        await inner.set(key, value, ttl);
      } catch (err) {
        reportDegradation("set", err);
      }
    },
    async delete(key) {
      try {
        await inner.delete(key);
      } catch (err) {
        reportDegradation("delete", err);
      }
    },
  };
}

export { resilientSecondaryStorage };
