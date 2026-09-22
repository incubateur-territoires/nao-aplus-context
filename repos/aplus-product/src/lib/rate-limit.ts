import { getRedisClient } from "./redis";

interface RateLimitConfig {
  max: number;
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// ============= In-memory fallback =============

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function checkRateLimitMemory(
  storeName: string,
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let store = stores.get(storeName);
  if (!store) {
    store = new Map();
    stores.set(storeName, store);
  }

  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.max - 1, retryAfterSeconds: 0 };
  }

  if (entry.count >= config.max) {
    const retryAfterSeconds = Math.ceil(
      (entry.windowStart + windowMs - now) / 1000,
    );
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.max - entry.count,
    retryAfterSeconds: 0,
  };
}

// Cleanup expired entries every 60s
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [storeName, store] of stores) {
    for (const [key, entry] of store) {
      if (now - entry.windowStart > 15 * 60 * 1000) {
        store.delete(key);
      }
    }
    if (store.size === 0) {
      stores.delete(storeName);
    }
  }
}, 60 * 1000);
if (typeof cleanupInterval.unref === "function") {
  cleanupInterval.unref();
}

// ============= Redis implementation =============

async function checkRateLimitRedis(
  storeName: string,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (!redis) {
    return checkRateLimitMemory(storeName, key, config);
  }

  const redisKey = `rl:${storeName}:${key}`;

  try {
    const results = await redis.multi().incr(redisKey).ttl(redisKey).exec();

    if (!results) {
      return checkRateLimitMemory(storeName, key, config);
    }

    const count = results[0][1] as number;
    const ttl = results[1][1] as number;

    // First request in window: set expiry
    if (count === 1 || ttl === -1) {
      await redis.expire(redisKey, config.windowSeconds);
    }

    if (count > config.max) {
      const retryAfterSeconds = ttl > 0 ? ttl : config.windowSeconds;
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    return {
      allowed: true,
      remaining: config.max - count,
      retryAfterSeconds: 0,
    };
  } catch {
    // Redis down: fallback to memory
    return checkRateLimitMemory(storeName, key, config);
  }
}

// ============= Public API =============

/**
 * Check rate limit. Uses Redis if available, falls back to in-memory.
 */
async function checkRateLimit(
  storeName: string,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  return checkRateLimitRedis(storeName, key, config);
}

export { checkRateLimit, checkRateLimitMemory, stores };
export type { RateLimitConfig, RateLimitResult };
