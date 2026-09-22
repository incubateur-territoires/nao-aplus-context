import "server-only";
import { headers } from "next/headers";
import { analytics } from "./analytics";
import { getCurrentUserId } from "@/utils/auth-server";
import type {
  AnalyticsEventName,
  AnalyticsEventMetadataMap,
  BaseAnalyticsEvent,
} from "@/types/analytics";
import { getEventCategory } from "@/types/analytics";

/**
 * Track an event from a server component or API route
 */
export async function trackServerEvent<T extends AnalyticsEventName>(
  eventName: T,
  metadata?: T extends keyof AnalyticsEventMetadataMap
    ? AnalyticsEventMetadataMap[T]
    : Record<string, unknown>,
): Promise<void> {
  try {
    const headersList = await headers();
    const userId = await getCurrentUserId();

    // Extract page URL from various headers
    const host = headersList.get("host");
    const protocol = headersList.get("x-forwarded-proto") ?? "https";
    const pathname =
      headersList.get("x-invoke-path") ?? headersList.get("x-matched-path");
    const fullUrl = headersList.get("referer"); // Current page URL often in referer for SSR

    const event: BaseAnalyticsEvent = {
      eventName,
      eventCategory: getEventCategory(eventName),
      userId,
      userAgent: headersList.get("user-agent") ?? null,
      referrer: headersList.get("referer") ?? null,
      pageUrl:
        fullUrl ??
        (host && pathname ? `${protocol}://${host}${pathname}` : null),
      pagePath: pathname ?? null,
      ipAddress: getClientIp(headersList),
      metadata: (metadata as Record<string, unknown>) ?? null,
      occurredAt: new Date(),
    };

    await analytics.trackEvent(event);
  } catch (error) {
    console.error("[Analytics] Failed to track server event:", error);
  }
}

/**
 * Track an event with explicit user context (for use in tRPC middleware)
 */
export async function trackEventWithContext(
  eventName: AnalyticsEventName,
  userId: string | null,
  metadata?: Record<string, unknown>,
  additionalContext?: {
    userAgent?: string | null;
    referrer?: string | null;
    ipAddress?: string | null;
    pagePath?: string | null;
  },
): Promise<void> {
  try {
    const event: BaseAnalyticsEvent = {
      eventName,
      eventCategory: getEventCategory(eventName),
      userId,
      metadata: metadata ?? null,
      occurredAt: new Date(),
      ...additionalContext,
    };

    await analytics.trackEvent(event);
  } catch (error) {
    console.error("[Analytics] Failed to track event with context:", error);
  }
}

/**
 * Get client IP from headers
 */
function getClientIp(headersList: Headers): string | null {
  // Check various headers for the real client IP
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headersList.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return null;
}
