import { NextRequest, NextResponse } from "next/server";
import { analytics } from "@/lib/analytics/analytics";
import { auth } from "@/lib/auth";
import type { BaseAnalyticsEvent, AnalyticsEventName } from "@/types/analytics";
import { getEventCategory } from "@/types/analytics";

interface ClientEvent {
  eventName: string;
  metadata: Record<string, unknown>;
  context: {
    sessionId?: string | null;
    pageUrl?: string | null;
    pagePath?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
  };
  timestamp?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Validate session and derive userId server-side
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    const userId = session.user.id;

    const body = await req.json();
    const events = body.events as ClientEvent[];

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No events provided" },
        { status: 400 },
      );
    }

    // Rate limiting: max 100 events per request
    if (events.length > 100) {
      return NextResponse.json(
        { ok: false, message: "Too many events" },
        { status: 400 },
      );
    }

    // Get client IP (prefer x-real-ip set by reverse proxy)
    const realIp = req.headers.get("x-real-ip");
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = realIp ?? forwardedFor?.split(",")[0]?.trim() ?? null;

    const formattedEvents: BaseAnalyticsEvent[] = events.map((event) => ({
      eventName: event.eventName as AnalyticsEventName,
      eventCategory: getEventCategory(event.eventName as AnalyticsEventName),
      userId,
      sessionId: event.context?.sessionId ?? null,
      pageUrl: event.context?.pageUrl ?? null,
      pagePath: event.context?.pagePath ?? null,
      userAgent: event.context?.userAgent ?? null,
      referrer: event.context?.referrer ?? null,
      metadata: event.metadata ?? null,
      ipAddress,
      occurredAt: event.timestamp ? new Date(event.timestamp) : null,
    }));

    await analytics.trackBatch(formattedEvents);
    await analytics.flush();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Analytics API] Error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal error" },
      { status: 500 },
    );
  }
}
