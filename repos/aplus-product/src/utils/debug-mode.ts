/**
 * Server-side debug-mode gate.
 *
 * Reads `APP_ENVIRONMENT` (a non-public env var, source of truth for
 * Sentry / Mattermost as well) so a stray `NEXT_PUBLIC_*` flag flip in
 * the client bundle cannot enable privileged endpoints
 * (impersonation directory, debug emails, manual cron).
 *
 * Allowlist semantics — fail-closed. Only "local" and "staging" enable
 * debug mode. Anything else (production, undefined, typo, empty) keeps
 * it disabled, so a missing or misconfigured env var cannot accidentally
 * expose privileged endpoints in production.
 */
export function isDebugModeEnabled(): boolean {
  const env = process.env.APP_ENVIRONMENT;
  return env === "local" || env === "staging";
}
