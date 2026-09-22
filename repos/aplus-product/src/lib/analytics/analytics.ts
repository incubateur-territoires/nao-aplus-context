import type { AnalyticsProvider } from "./analytics.interface";
import { PostgresAnalyticsProvider } from "./providers/postgres-analytics";

// Singleton instance
let analyticsInstance: AnalyticsProvider | null = null;

export function getAnalytics(): AnalyticsProvider {
  if (!analyticsInstance) {
    // Can be swapped to other providers via env var in the future
    const provider = "postgres" as const;

    switch (provider) {
      case "postgres":
      default:
        analyticsInstance = new PostgresAnalyticsProvider();
        break;
      // Future: case "posthog": analyticsInstance = new PostHogProvider(); break;
    }
  }
  return analyticsInstance;
}

// Convenience export for direct usage
export const analytics = getAnalytics();
