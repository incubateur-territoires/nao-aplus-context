import { buildSentryIssuesUrl, sentryDetailLabel } from "./sentry-url";

const ORGANIZATION_URL = "https://sentry.exemple.test/organizations/org";

describe("buildSentryIssuesUrl", () => {
  const original = process.env.SENTRY_ORGANIZATION_URL;
  afterEach(() => {
    process.env.SENTRY_ORGANIZATION_URL = original;
  });

  it("encode la recherche par tag dans l'URL des issues", () => {
    process.env.SENTRY_ORGANIZATION_URL = `${ORGANIZATION_URL}/`;
    const url = new URL(buildSentryIssuesUrl("cron:reports/deletion") ?? "");

    expect(url.pathname).toBe("/organizations/org/issues/");
    expect(url.searchParams.get("query")).toBe("cron:reports/deletion");
  });

  it("n'invente pas de lien quand l'URL n'est pas configurée", () => {
    delete process.env.SENTRY_ORGANIZATION_URL;

    expect(buildSentryIssuesUrl("template:X")).toBeNull();
    expect(sentryDetailLabel("template:X")).toBe("détail dans Sentry");
  });
});
