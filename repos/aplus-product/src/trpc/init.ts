import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { USER_ROLES, UserRole } from "@/constants/user-roles";
import {
  trackMutationEvent,
  TRACKED_MUTATIONS,
} from "./middleware/analytics.middleware";
import { checkRateLimit, checkRateLimitMemory } from "@/lib/rate-limit";
import { resolveClientErrorMessage } from "@/utils/trpc-error-message";

// Extended user type returned by customSession plugin
export interface ExtendedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  emailVerified: boolean;
  role: UserRole;
  twoFactorEnabled?: boolean | null;
  isInactive?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Request context for analytics (optional, only available in real requests)
export interface RequestContext {
  userAgent: string | null;
  referrer: string | null;
  ipAddress: string | null;
  pagePath: string | null;
}

// tRPC context type
export interface TRPCContext {
  userId: string | null;
  user: ExtendedUser | null;
  impersonatedBy?: string | null;
  requestContext?: RequestContext | null;
}

export async function createTRPCContext(): Promise<TRPCContext> {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  try {
    // Dynamic import to avoid bundling next/headers for the client
    const { headers } = await import("next/headers");
    const headersList = await headers();

    const session = await auth.api.getSession({
      headers: headersList,
    });

    // Extract request context for analytics
    const forwardedFor = headersList.get("x-forwarded-for");
    const realIp = headersList.get("x-real-ip");

    // Extract impersonatedBy from session (added by better-auth admin plugin)
    const sessionRecord = session?.session as
      | (Record<string, unknown> & { impersonatedBy?: string | null })
      | undefined;

    return {
      userId: session?.user?.id || null,
      user: (session?.user as ExtendedUser | null) || null,
      impersonatedBy: sessionRecord?.impersonatedBy ?? null,
      requestContext: {
        userAgent: headersList.get("user-agent") ?? null,
        referrer: headersList.get("referer") ?? null,
        ipAddress: realIp ?? forwardedFor?.split(",")[0]?.trim() ?? null,
        pagePath: headersList.get("x-invoke-path") ?? null,
      },
    };
  } catch (error) {
    console.error("tRPC Context - Auth Error:", error);
    return {
      userId: null,
      user: null as ExtendedUser | null,
      impersonatedBy: null,
      requestContext: null,
    };
  }
}
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<TRPCContext>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
  // tRPC renvoie au client le message de l'erreur d'origine, en production
  // comprise (seule la stack est réservée au dev). Sentry garde l'erreur
  // complète dans tous les cas.
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      message: resolveClientErrorMessage({
        code: error.code,
        message: shape.message,
        causeName: (error.cause as Error | undefined)?.name,
        isProduction: process.env.NODE_ENV === "production",
      }),
    };
  },
});

// ============= MIDDLEWARE =============

// Logging middleware - logs all procedure calls with timing
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;

  console.log(
    `[tRPC] ${type} ${path} - ${duration}ms - user: ${ctx.userId ?? "anon"}`,
  );

  return result;
});

// Sentry middleware - captures errors and adds context
const sentryMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  Sentry.setContext("trpc", { path, type });
  if (ctx.userId) {
    Sentry.setUser({ id: ctx.userId });
  }

  try {
    return await next();
  } catch (error) {
    Sentry.captureException(error, {
      tags: { trpc_path: path, trpc_type: type },
    });
    throw error;
  }
});

// Rate limit middleware - prevents abuse
const rateLimitMiddleware = t.middleware(async ({ type, next, ctx }) => {
  if (process.env.LOAD_TEST === "true") return next();

  const key = ctx.userId ?? ctx.requestContext?.ipAddress;
  if (!key) return next();

  const storeName = ctx.userId ? `trpc:auth:${type}` : `trpc:public:${type}`;
  const config = ctx.userId
    ? type === "mutation"
      ? { max: 60, windowSeconds: 60 }
      : { max: 200, windowSeconds: 60 }
    : { max: 30, windowSeconds: 60 };

  // Use in-memory rate limit for authenticated queries to avoid N+1 Redis
  // calls in batched tRPC requests. Redis is kept for mutations and public requests.
  const useMemory = !!ctx.userId && type === "query";
  const result = useMemory
    ? checkRateLimitMemory(storeName, key, config)
    : await checkRateLimit(storeName, key, config);
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Trop de requêtes. Réessayez dans ${result.retryAfterSeconds} secondes.`,
    });
  }
  return next();
});

// Auth middleware - ensures user is authenticated
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Vous devez être connecté pour effectuer cette action.",
    });
  }

  // La désactivation n'est contrôlée qu'à la connexion par better-auth : une
  // session déjà ouverte survivrait à la désactivation du compte. On réévalue
  // donc l'état à chaque requête (le customSession recharge l'utilisateur en
  // base, la donnée est fraîche).
  if (ctx.user.isInactive) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Ce compte a été désactivé.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      user: ctx.user,
    },
  });
});

// Admin middleware - ensures user has ADMIN role
const adminMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== USER_ROLES.ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cette action est réservée aux administrateurs.",
    });
  }

  // Le 2FA admin n'était imposé que par la garde de pages (proxy.ts) : un
  // admin sans 2FA gardait toute l'API en appel direct. L'activation se fait
  // via les endpoints better-auth, pas via tRPC — pas de dépendance circulaire.
  if (!ctx.user.twoFactorEnabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "L'authentification à deux facteurs est requise pour les actions d'administration.",
    });
  }

  return next();
});

// Analytics middleware - tracks configured mutations
const analyticsTracking = t.middleware(
  async ({ path, type, next, ctx, getRawInput }) => {
    const result = await next();

    // Only track successful mutations that are in the tracked list
    if (type === "mutation" && result.ok && TRACKED_MUTATIONS[path]) {
      const input = await getRawInput();
      // Use admin userId when session is impersonated
      const analyticsUserId = ctx.impersonatedBy ?? ctx.userId;
      trackMutationEvent(
        path,
        analyticsUserId,
        input,
        result.data,
        ctx.requestContext ?? null,
      );
    }

    return result;
  },
);

// ============= PROCEDURE VARIANTS =============

// Base router and caller factory
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// Public procedure - no auth required, includes logging, rate limiting and Sentry
export const publicProcedure = t.procedure
  .use(loggingMiddleware)
  .use(rateLimitMiddleware)
  .use(sentryMiddleware);

// Protected procedure - requires authenticated user + analytics tracking
export const protectedProcedure = publicProcedure
  .use(authMiddleware)
  .use(analyticsTracking);

// Admin procedure - requires admin role
export const adminProcedure = protectedProcedure.use(adminMiddleware);

// Legacy export for backward compatibility during migration
export const baseProcedure = publicProcedure;
