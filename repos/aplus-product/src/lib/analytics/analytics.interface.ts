import type {
  AnalyticsEventName,
  AnalyticsEventMetadataMap,
  BaseAnalyticsEvent,
} from "@/types/analytics";

export interface AnalyticsProvider {
  /**
   * Track a single event with type-safe metadata
   */
  track<T extends AnalyticsEventName>(
    eventName: T,
    metadata?: T extends keyof AnalyticsEventMetadataMap
      ? AnalyticsEventMetadataMap[T]
      : Record<string, unknown>,
  ): Promise<void>;

  /**
   * Track with full event context
   */
  trackEvent(event: BaseAnalyticsEvent): Promise<void>;

  /**
   * Batch track multiple events
   */
  trackBatch(events: BaseAnalyticsEvent[]): Promise<void>;

  /**
   * Track a page view
   */
  trackPageView(
    path: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;

  /**
   * Flush pending events (for batching)
   */
  flush(): Promise<void>;

  /**
   * Cleanup resources
   */
  destroy(): void;
}
