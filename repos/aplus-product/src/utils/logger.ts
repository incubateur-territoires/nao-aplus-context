/**
 * Logger serveur pour les traitements de fond (cron, services).
 *
 * `next.config.mjs` active `compiler.removeConsole` en production : tous les
 * appels `console.*` sont retirés du bundle au build, côté serveur comme côté
 * client. Les récapitulatifs des cron jobs disparaissaient donc des logs
 * Scalingo, rendant tout échec invisible. Ce logger écrit directement sur
 * `process.stdout` / `process.stderr`, que le compilateur ne touche pas, ce qui
 * préserve le nettoyage des `console.*` côté navigateur.
 *
 * Ne jamais passer de données personnelles en `meta` : les logs Scalingo ne sont
 * pas un lieu de stockage de PII. Des identifiants suffisent.
 */

interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function serializeMeta(meta: Record<string, unknown>): string {
  try {
    return ` ${JSON.stringify(meta, replaceErrors)}`;
  } catch {
    return " [meta non sérialisable]";
  }
}

function replaceErrors(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(
  stream: NodeJS.WriteStream,
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const suffix = meta ? serializeMeta(meta) : "";
  stream.write(`[${scope}] ${message}${suffix}\n`);
}

/**
 * Crée un logger préfixé par un scope, ex. `createLogger("Report Deletion CRON")`.
 */
export function createLogger(scope: string): Logger {
  return {
    info(message, meta) {
      write(process.stdout, scope, message, meta);
    },
    error(message, meta) {
      write(process.stderr, scope, message, meta);
    },
  };
}
