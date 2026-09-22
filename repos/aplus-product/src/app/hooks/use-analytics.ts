"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import type {
  AnalyticsEventName,
  AnalyticsEventMetadataMap,
} from "@/types/analytics";

interface AnalyticsContext {
  userId: string | null;
  sessionId: string | null;
  pageUrl: string;
  pagePath: string;
  userAgent: string;
  referrer: string;
}

interface QueuedEvent {
  eventName: string;
  metadata: Record<string, unknown>;
  context: AnalyticsContext;
  timestamp: string;
}

// Client-side event queue for batching
const eventQueue: QueuedEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("analytics_session_id", sessionId);
  }
  return sessionId;
}

async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;

  const eventsToSend = [...eventQueue];
  eventQueue.length = 0;

  try {
    await fetch("/api/analytics/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: eventsToSend }),
    });
  } catch (error) {
    console.error("[Analytics] Failed to send events:", error);
    // Re-queue failed events
    eventQueue.unshift(...eventsToSend);
  }
}

function scheduleFlush(): void {
  if (flushTimeout) return;
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    void flushEvents();
  }, 2000);
}

function useAnalyticsContext() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const getContext = useCallback((): AnalyticsContext => {
    return {
      userId: session?.user?.id ?? null,
      sessionId: getSessionId(),
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      pagePath: pathname,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      referrer: typeof document !== "undefined" ? document.referrer : "",
    };
  }, [session?.user?.id, pathname]);

  return { getContext, pathname, session };
}

/**
 * Hook for tracking custom events. Does NOT auto-track page views.
 * Use this in components that only need to track specific events.
 */
export function useAnalytics() {
  const { getContext } = useAnalyticsContext();

  const track = useCallback(
    <T extends AnalyticsEventName>(
      eventName: T,
      metadata?: T extends keyof AnalyticsEventMetadataMap
        ? AnalyticsEventMetadataMap[T]
        : Record<string, unknown>,
    ) => {
      const context = getContext();
      eventQueue.push({
        eventName,
        metadata: (metadata as Record<string, unknown>) ?? {},
        context,
        timestamp: new Date().toISOString(),
      });
      scheduleFlush();
    },
    [getContext],
  );

  const flush = useCallback(async () => {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    await flushEvents();
  }, []);

  return { track, flush };
}

/**
 * Hook that auto-tracks page views on route changes.
 * Must be used in a SINGLE place (AnalyticsProvider) to avoid duplicate page_view events.
 */
export function usePageViewTracking() {
  const { pathname, session } = useAnalyticsContext();
  const previousPathRef = useRef<string | null>(null);

  // Auto-track page views on route change
  useEffect(() => {
    if (previousPathRef.current === pathname) {
      return;
    }

    const context: AnalyticsContext = {
      userId: session?.user?.id ?? null,
      sessionId: getSessionId(),
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      pagePath: pathname,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      referrer: typeof document !== "undefined" ? document.referrer : "",
    };

    eventQueue.push({
      eventName: "page_view",
      metadata: {
        pageTitle: typeof document !== "undefined" ? document.title : "",
        previousPath: previousPathRef.current,
      },
      context,
      timestamp: new Date().toISOString(),
    });

    previousPathRef.current = pathname;
    scheduleFlush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Flush on page unload
  useEffect(() => {
    function handleBeforeUnload() {
      if (
        eventQueue.length > 0 &&
        typeof navigator !== "undefined" &&
        navigator.sendBeacon
      ) {
        navigator.sendBeacon(
          "/api/analytics/batch",
          JSON.stringify({ events: [...eventQueue] }),
        );
        eventQueue.length = 0;
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}
