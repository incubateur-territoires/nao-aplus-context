import { prisma } from "@/lib/prisma";
import type { AnalyticsProvider } from "../analytics.interface";
import type {
  BaseAnalyticsEvent,
  AnalyticsEventName,
  AnalyticsEventMetadataMap,
} from "@/types/analytics";
import { getEventCategory } from "@/types/analytics";
import { Prisma } from "@/generated/prisma/client";

// L'utilisateur cible d'une action (désactivation, impersonation, retrait
// d'équipe...) est fourni dans le metadata ; on le copie dans la colonne
// dédiée `targetUserId` pour permettre des requêtes indexées.
export function extractTargetUserId(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null;
  const value = metadata.targetUserId ?? metadata.removedUserId;
  return typeof value === "string" ? value : null;
}

export class PostgresAnalyticsProvider implements AnalyticsProvider {
  private eventQueue: BaseAnalyticsEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    // Start flush interval for batching (server-side only)
    if (typeof window === "undefined") {
      this.startFlushInterval();
    }
  }

  private startFlushInterval(): void {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  async track<T extends AnalyticsEventName>(
    eventName: T,
    metadata?: T extends keyof AnalyticsEventMetadataMap
      ? AnalyticsEventMetadataMap[T]
      : Record<string, unknown>,
  ): Promise<void> {
    const event: BaseAnalyticsEvent = {
      eventName,
      eventCategory: getEventCategory(eventName),
      metadata: (metadata as Record<string, unknown>) ?? null,
    };
    await this.trackEvent(event);
  }

  async trackEvent(event: BaseAnalyticsEvent): Promise<void> {
    this.eventQueue.push(event);

    if (this.eventQueue.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  async trackBatch(events: BaseAnalyticsEvent[]): Promise<void> {
    this.eventQueue.push(...events);

    if (this.eventQueue.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  async trackPageView(
    path: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const event: BaseAnalyticsEvent = {
      eventName: "page_view",
      eventCategory: "page_view",
      pagePath: path,
      metadata: metadata ?? null,
    };
    await this.trackEvent(event);
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await prisma.analyticsEvent.createMany({
        data: eventsToFlush.map((event) => ({
          eventName: event.eventName,
          eventCategory: event.eventCategory,
          userId: event.userId ?? null,
          targetUserId: extractTargetUserId(event.metadata),
          sessionId: event.sessionId ?? null,
          pageUrl: event.pageUrl ?? null,
          pagePath: event.pagePath ?? null,
          referrer: event.referrer ?? null,
          metadata: event.metadata
            ? (event.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          userAgent: event.userAgent ?? null,
          ipAddress: event.ipAddress ?? null,
          occurredAt: event.occurredAt ?? null,
        })),
      });
    } catch (error) {
      console.error("[Analytics] Failed to flush events:", error);
      // Re-queue failed events
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}
