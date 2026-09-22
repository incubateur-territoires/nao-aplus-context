import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as Sentry from "@sentry/nextjs";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "@/utils/database-url";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
};

const source = resolveDatabaseUrl(process.env);
let connectionString = source.url;

if (!connectionString) {
  throw new Error(
    source.target
      ? `${source.envVar} environment variable is not set (DB_TARGET=${source.target})`
      : "DATABASE_URL environment variable is not set",
  );
}

const isLoopback =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");
// Cible distante jointe sur localhost = tunnel SSH, SSL reste requis
const isTunnel = !!source.target && source.target !== "local" && isLoopback;
const isLocalDatabase = !isTunnel && isLoopback;

// Remove sslmode from connection string - we'll configure SSL via Pool options
connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, "");
// Clean up any trailing ? or & from URL
connectionString = connectionString.replace(/[?&]$/, "");

// Fix PEM format: env vars often store certs without newlines
function formatPemCert(cert: string | undefined): string | undefined {
  if (!cert) return undefined;
  if (cert.includes("\n")) return cert;
  return cert
    .replace(/-----BEGIN CERTIFICATE-----/, "-----BEGIN CERTIFICATE-----\n")
    .replace(/-----END CERTIFICATE-----/, "\n-----END CERTIFICATE-----\n")
    .replace(/(.{64})(?!-)/g, "$1\n");
}

const caCert = formatPemCert(process.env.POSTGRESQL_CA_CERT);

const pool = new Pool({
  connectionString,
  // 20 connexions/dyno × 10 dynos max (plafond autoscaler) = 200 < 240
  // connexions PostgreSQL utilisables (max_connections=260 − 20 réservées
  // superuser, mesuré sur l'addon business-4096). Marge conservée pour les
  // connexions hors-pool (migrations, monitoring). Relâche le goulot par dyno
  // à l'origine des « timeout exceeded when trying to connect » lors des pics
  // de trafic qui précèdent un scale-up.
  max: 20,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
  ssl: isLocalDatabase
    ? false
    : {
        rejectUnauthorized: !!caCert,
        ...(caCert && { ca: caCert }),
        // Via un tunnel SSH, l'URL pointe sur localhost alors que la base
        // présente le certificat de son vrai hostname Scalingo : la
        // vérification du nom d'hôte échoue toujours (P1011). On ne la
        // désactive QUE dans ce cas — la chaîne de certification reste
        // vérifiée contre le CA, et le tunnel SSH authentifie déjà le pair.
        ...(isTunnel && { checkServerIdentity: () => undefined }),
      },
});

pool.on("error", (err) => {
  Sentry.captureException(err, { tags: { source: "pg-pool" } });
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
