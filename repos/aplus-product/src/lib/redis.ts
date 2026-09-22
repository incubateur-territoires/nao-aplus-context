import Redis from "ioredis";
import * as Sentry from "@sentry/nextjs";

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;

  const url = process.env.SCALINGO_REDIS_URL;
  if (!url) return null;

  try {
    redis = new Redis(url, {
      tls: url.startsWith("rediss://")
        ? { rejectUnauthorized: false }
        : undefined,
      maxRetriesPerRequest: 1,
      // Reconnexion infinie avec backoff plafonné : ne JAMAIS renvoyer null,
      // sinon ioredis abandonne définitivement et chaque commande suivante
      // lève "Connection is closed." jusqu'au prochain redémarrage du process.
      retryStrategy(times) {
        return Math.min(times * 200, 5000);
      },
      // Reconnexion ciblée sur les erreurs de bascule master/replica
      // (failover/maintenance d'un Redis managé), comme recommandé par la
      // doc ioredis. On renvoie 2 pour rejouer la commande après reconnexion
      // au lieu de la faire échouer. On ne reconnecte PAS sur les erreurs
      // applicatives, pour éviter toute boucle de reconnexion.
      reconnectOnError(err) {
        const targetErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET"];
        if (targetErrors.some((e) => err.message.includes(e))) {
          return 2;
        }
        return false;
      },
      lazyConnect: true,
      connectTimeout: 3000,
      commandTimeout: 2000,
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    // Filet de sécurité : si le client atteint malgré tout un état terminal,
    // on libère le singleton pour qu'un prochain getRedisClient() en recrée
    // un sain au lieu de servir une instance morte.
    redis.on("end", () => {
      console.error("[Redis] Connection ended, resetting client");
      // Signal bas-volume mais à forte valeur : une connexion terminée = la
      // cause racine des bascules/resets TLS qui génèrent les 500.
      Sentry.captureMessage("[Redis] Connection ended, resetting client", {
        level: "warning",
        tags: { source: "redis" },
      });
      redis = null;
    });

    redis.connect().catch((err) => {
      console.error("[Redis] Initial connect failed:", err.message);
      Sentry.captureException(err, { tags: { source: "redis" } });
      redis = null;
    });
  } catch (err) {
    console.error("[Redis] Failed to create client:", err);
    redis = null;
  }

  return redis;
}

export { getRedisClient };
