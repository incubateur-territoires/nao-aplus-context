/**
 * Lien vers les issues Sentry qui correspondent à une recherche par tags, ou
 * `null` si l'URL de l'organisation n'est pas configurée.
 */
export function buildSentryIssuesUrl(query: string): string | null {
  const organizationUrl = process.env.SENTRY_ORGANIZATION_URL;
  if (!organizationUrl) return null;

  const params = new URLSearchParams({ query, statsPeriod: "14d" });
  return `${organizationUrl.replace(/\/+$/, "")}/issues/?${params.toString()}`;
}

/** « détail dans Sentry », en lien quand l'URL est connue. */
export function sentryDetailLabel(query: string): string {
  const url = buildSentryIssuesUrl(query);
  return url ? `[détail dans Sentry](${url})` : "détail dans Sentry";
}
