// Sans DB_TARGET, la base vient de DATABASE_URL ; avec, de la variable de la
// cible. Seul point d'accord entre le client Prisma, prisma.config.ts et validate-env.

export const DATABASE_URL_BY_TARGET = {
  local: "LOCAL_DATABASE_URL",
  staging: "STAGING_DATABASE_URL",
  prod: "PROD_DATABASE_URL",
} as const;

export type DbTarget = keyof typeof DATABASE_URL_BY_TARGET;

export interface DatabaseUrlSource {
  target: DbTarget | undefined;
  envVar: string;
  url: string | undefined;
}

function isDbTarget(value: string): value is DbTarget {
  return Object.hasOwn(DATABASE_URL_BY_TARGET, value);
}

export function resolveDatabaseUrl(
  env: Record<string, string | undefined>,
): DatabaseUrlSource {
  const rawTarget = env.DB_TARGET?.trim();
  if (!rawTarget) {
    return { target: undefined, envVar: "DATABASE_URL", url: env.DATABASE_URL };
  }
  if (!isDbTarget(rawTarget)) {
    const known = Object.keys(DATABASE_URL_BY_TARGET).join(", ");
    throw new Error(`DB_TARGET="${rawTarget}" inconnu (attendu : ${known})`);
  }
  const envVar = DATABASE_URL_BY_TARGET[rawTarget];
  return { target: rawTarget, envVar, url: env[envVar] };
}
