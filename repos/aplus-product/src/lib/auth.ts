import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { customSession, admin, twoFactor } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import argon2 from "argon2";
import prisma from "./prisma";
import { redisStorage } from "@better-auth/redis-storage";
import { getRedisClient } from "./redis";
import { resilientSecondaryStorage } from "./resilient-secondary-storage";
import { normalizeEmail } from "@/utils/normalize";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackEventWithContext } from "@/lib/analytics/server-analytics";
import * as Sentry from "@sentry/nextjs";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    // Aligné sur la politique des formulaires (12 caractères) : sans cette
    // borne, l'API brute (/sign-up/email, /change-password) accepterait le
    // défaut better-auth de 8.
    minPasswordLength: 12,
    password: {
      hash: (password) => argon2.hash(password),
      verify: ({ password, hash }) => argon2.verify(hash, password),
    },
  },
  // Plateforme sur invitation uniquement : l'inscription n'est autorisée
  // qu'au travers du flux d'invitation (PendingUser + token).
  // Voir hooks.before pour la vérification d'invitation valide.
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: true,
      },
      lastName: {
        type: "string",
        required: true,
      },
      role: {
        type: "string",
        required: true,
        defaultValue: "user",
        input: false, // Ne pas permettre la modification via l'API
      },
    },
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    // Désactivé volontairement : customSession relit l'utilisateur en base à
    // chaque appel même cache actif (vérifié), donc on ne gagnerait que la
    // lecture Redis en retardant la révocation de session de maxAge.
    cookieCache: {
      enabled: false,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Filet de sécurité : quelle que soit la casse/les espaces envoyés par
        // le client, le user est toujours stocké avec un email normalisé. Évite
        // qu'un user et un pendingUser portent « le même » email sous deux
        // formes différentes (cause d'un doublon constaté en production).
        before: async (user) => {
          return { data: { ...user, email: normalizeEmail(user.email) } };
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Vérification utilisateur inactif lors de la connexion
      if (ctx.path === "/sign-in/email") {
        const body = ctx.body as { email?: string } | undefined;
        if (body?.email) {
          // Frein par compte visé : la limite IP ci-dessous est volontairement
          // large (proxy sortant partagé des agents) et ne protège pas un
          // compte d'un brute force lent ou distribué.
          if (process.env.LOAD_TEST !== "true") {
            const attempt = await checkRateLimit(
              "auth-signin-account",
              normalizeEmail(body.email),
              { max: 10, windowSeconds: 300 },
            );
            if (!attempt.allowed) {
              throw new APIError("TOO_MANY_REQUESTS", {
                message: "TooManyAttempts",
              });
            }
          }

          const user = await prisma.user.findUnique({
            where: { email: normalizeEmail(body.email) },
            select: { isInactive: true },
          });
          if (user?.isInactive) {
            throw new APIError("FORBIDDEN", {
              message: "AccountInactive",
            });
          }
        }
      }

      // Inscription sur invitation uniquement : exiger le token d'invitation
      // lui-même, pas seulement l'existence d'une invitation pour l'email.
      // Sans cela, quiconque connaît une adresse invitée pourrait créer le
      // compte à sa place avec son propre mot de passe (pré-emption de
      // compte). Le seul appelant légitime est `user.completeRegistration`,
      // qui a validé le token et le transmet dans cet en-tête interne.
      if (ctx.path === "/sign-up/email") {
        const body = ctx.body as { email?: string } | undefined;
        const email = body?.email ? normalizeEmail(body.email) : undefined;
        const invitationToken = ctx.headers?.get("x-invitation-token");
        if (!email || !invitationToken) {
          throw new APIError("FORBIDDEN", { message: "SignUpDisabled" });
        }
        const pendingUser = await prisma.pendingUser.findFirst({
          where: {
            email: { equals: email, mode: "insensitive" },
            verificationToken: invitationToken,
          },
          select: { tokenExpiresAt: true },
        });
        if (!pendingUser || pendingUser.tokenExpiresAt < new Date()) {
          throw new APIError("FORBIDDEN", { message: "SignUpDisabled" });
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Tracking serveur de la connexion. On émet `auth_sign_in` au moment où
      // une session est réellement créée : pour un compte 2FA, `/sign-in/email`
      // n'ouvre que le challenge (pas de session), la session naît à la
      // vérification 2FA. Tracké ici et non côté client car ce dernier redirige
      // (rechargement complet) avant que la session/userId soit disponible, ce
      // qui rendait l'événement inattribuable (« Ne s'est jamais connecté »).
      const methodBySignInPath: Record<
        string,
        "email" | "totp" | "backup-code"
      > = {
        "/sign-in/email": "email",
        "/two-factor/verify-totp": "totp",
        "/two-factor/verify-backup-code": "backup-code",
      };
      if (!(ctx.path in methodBySignInPath)) return;

      const forwardedFor = ctx.headers?.get("x-forwarded-for");
      const requestContext = {
        userAgent: ctx.headers?.get("user-agent") ?? null,
        ipAddress:
          forwardedFor?.split(",")[0]?.trim() ??
          ctx.headers?.get("x-real-ip") ??
          null,
      };

      const userId = ctx.context.newSession?.user?.id;
      if (userId) {
        await trackEventWithContext(
          "auth_sign_in",
          userId,
          { method: "email" },
          requestContext,
        );
        return;
      }

      // Journalisation des échecs de connexion (exigence ANSSI : détecter
      // brute force / credential stuffing). Quand l'endpoint échoue,
      // better-auth place l'APIError dans `ctx.context.returned` avant
      // d'exécuter les hooks after — les identifiants invalides ne throw
      // pas jusqu'ici. Un `/sign-in/email` réussi sur un compte 2FA (ni
      // session ni APIError : simple challenge) ne compte ni en succès ni
      // en échec.
      const returned = ctx.context.returned;
      if (returned instanceof APIError) {
        const body = ctx.body as { email?: string } | undefined;
        await trackEventWithContext(
          "auth_sign_in_failed",
          null,
          {
            method: methodBySignInPath[ctx.path],
            email: body?.email ? normalizeEmail(body.email) : undefined,
            reason:
              (returned.body as { message?: string } | undefined)?.message ??
              String(returned.status),
          },
          requestContext,
        );
      }
    }),
  },

  plugins: [
    admin({
      impersonationSessionDuration: 60 * 60, // 1 heure
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    twoFactor({
      issuer: "Administration+",
      skipVerificationOnEnable: false,
      totpOptions: {
        digits: 6,
        period: 30,
      },
      backupCodeOptions: {
        amount: 10,
        length: 10,
      },
    }),
    customSession(async (session) => {
      const user = await prisma.user.findUnique({
        where: {
          id: session.user.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          emailVerified: true,
          role: true,
          twoFactorEnabled: true,
          isInactive: true,
        },
      });
      // Cast to access impersonatedBy added by admin plugin
      const sessionRecord = session.session as
        | (typeof session.session & { impersonatedBy?: string | null })
        | undefined;

      // Défense en profondeur : ne pas exposer le token de session ni les
      // métadonnées techniques (IP, user-agent) dans la réponse de get-session.
      // Le token est le porteur d'authentification ; le laisser lisible par le
      // JS client annulerait la protection httpOnly du cookie en cas de XSS.
      // Ces champs ne sont consommés nulle part (client comme serveur) ; on
      // conserve le reste de l'enregistrement (id, expiresAt, impersonatedBy…).
      const safeSession = { ...session.session } as Record<string, unknown>;
      delete safeSession.token;
      delete safeSession.ipAddress;
      delete safeSession.userAgent;

      return {
        ...session,
        session: safeSession,
        user: user,
        impersonatedBy: sessionRecord?.impersonatedBy ?? null,
      };
    }),
  ],
  rateLimit: {
    enabled: process.env.NODE_ENV !== "development",
    window: 60,
    max: 60,
    storage: getRedisClient() ? "secondary-storage" : "memory",
    customRules: {
      // Limite par IP, volontairement large : les agents partagent le même
      // proxy d'administration sortant, une limite serrée les bloquerait
      // collectivement. Le brute force est traité en aval par le lockout 2FA
      // et l'événement `auth_sign_in_failed`.
      "/sign-in/email": {
        window: 300,
        max: process.env.LOAD_TEST === "true" ? 10000 : 60,
      },
      "/sign-up/email": { window: 300, max: 60 },
      "/request-password-reset": { window: 300, max: 60 },
      "/reset-password": { window: 300, max: 60 },
      "/admin/impersonate-user": { window: 60, max: 60 },
      // Codes à espace réduit (6 chiffres / codes de secours) : limite serrée.
      "/two-factor/verify-totp": { window: 300, max: 10 },
      "/two-factor/verify-backup-code": { window: 300, max: 10 },
    },
  },
  ...(getRedisClient()
    ? {
        // Wrapper défensif : une panne/bascule Redis ne doit jamais devenir un
        // 500 sur /api/auth/*. better-auth appelle secondaryStorage.get/set
        // sans try/catch (cf. internal-adapter), donc on dégrade ici même.
        secondaryStorage: resilientSecondaryStorage(
          redisStorage({
            client: getRedisClient()!,
            keyPrefix: "ba:",
          }),
        ),
      }
    : {}),
  logger: {
    level: process.env.NODE_ENV === "production" ? "error" : "debug",
  },
  // Remonte à Sentry les erreurs des routes /api/auth/* (sign-in, get-session…).
  // better-auth les rattrape en interne et renvoie une 500 SANS throw, donc
  // ni `onRequestError` ni le middleware tRPC ne les voient : c'est l'unique
  // moyen de monitorer ces 500 (notamment celles dues à un hoquet Redis).
  onAPIError: {
    onError(error, ctx) {
      // `path` est présent à l'exécution (contexte d'endpoint) mais absent du
      // type AuthContext → accès défensif sans casser le typage.
      const path = (ctx as { path?: string } | undefined)?.path;
      // Définir onError désactive le logging interne de better-auth (il fait
      // `return` juste après) : on conserve donc une trace stderr (logs
      // Scalingo) en plus de la remontée Sentry.
      console.error("[Better Auth] API error", path ?? "", error);
      Sentry.captureException(error, {
        tags: { source: "better-auth" },
        extra: { path },
      });
    },
  },
  advanced: {
    cookiePrefix: "better-auth",

    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
});
