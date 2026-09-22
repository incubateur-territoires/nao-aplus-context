import { checkRateLimitMemory, stores } from "./rate-limit";

afterEach(() => {
  stores.clear();
});

describe("checkRateLimitMemory", () => {
  it("autorise les requêtes sous la limite", () => {
    const result = checkRateLimitMemory("test", "user1", {
      max: 5,
      windowSeconds: 60,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("bloque les requêtes au-dessus de la limite", () => {
    const config = { max: 3, windowSeconds: 60 };
    checkRateLimitMemory("test", "user1", config);
    checkRateLimitMemory("test", "user1", config);
    checkRateLimitMemory("test", "user1", config);

    const result = checkRateLimitMemory("test", "user1", config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("décrémente remaining correctement", () => {
    const config = { max: 5, windowSeconds: 60 };
    expect(checkRateLimitMemory("test", "user1", config).remaining).toBe(4);
    expect(checkRateLimitMemory("test", "user1", config).remaining).toBe(3);
    expect(checkRateLimitMemory("test", "user1", config).remaining).toBe(2);
    expect(checkRateLimitMemory("test", "user1", config).remaining).toBe(1);
    expect(checkRateLimitMemory("test", "user1", config).remaining).toBe(0);
  });

  it("reset après expiration de la fenêtre", () => {
    const config = { max: 2, windowSeconds: 1 };
    checkRateLimitMemory("test", "user1", config);
    checkRateLimitMemory("test", "user1", config);

    const blocked = checkRateLimitMemory("test", "user1", config);
    expect(blocked.allowed).toBe(false);

    // Simuler l'expiration en modifiant windowStart
    const store = stores.get("test")!;
    const entry = store.get("user1")!;
    entry.windowStart = Date.now() - 2000;

    const result = checkRateLimitMemory("test", "user1", config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("isole les stores entre eux", () => {
    const config = { max: 2, windowSeconds: 60 };
    checkRateLimitMemory("store-a", "user1", config);
    checkRateLimitMemory("store-a", "user1", config);

    const blockedInA = checkRateLimitMemory("store-a", "user1", config);
    expect(blockedInA.allowed).toBe(false);

    const allowedInB = checkRateLimitMemory("store-b", "user1", config);
    expect(allowedInB.allowed).toBe(true);
  });

  it("isole les clés entre elles", () => {
    const config = { max: 2, windowSeconds: 60 };
    checkRateLimitMemory("test", "user1", config);
    checkRateLimitMemory("test", "user1", config);

    const blockedUser1 = checkRateLimitMemory("test", "user1", config);
    expect(blockedUser1.allowed).toBe(false);

    const allowedUser2 = checkRateLimitMemory("test", "user2", config);
    expect(allowedUser2.allowed).toBe(true);
  });

  it("retourne retryAfterSeconds correct", () => {
    const config = { max: 1, windowSeconds: 30 };
    checkRateLimitMemory("test", "user1", config);

    const result = checkRateLimitMemory("test", "user1", config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(30);
  });
});
