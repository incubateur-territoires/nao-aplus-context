"use client";

import { ReportStatusDisplay } from "@/app/component/request-status-display/request-status-display";
import type { StatusTimelineEntryProps } from "../types";
import { useStatusViewTracking } from "@/app/hooks/use-status-view-tracking";
import { useSession } from "@/app/component/auth-provider/auth-provider";

export function StatusTimelineEntry({
  status,
  userTimezone,
}: StatusTimelineEntryProps) {
  const { data: session } = useSession();

  // Track status view (only if user is not the author of the status change)
  const isOwnStatusChange = status.authorId === session?.user?.id;
  const shouldTrack = !isOwnStatusChange && !!session?.user;
  const { elementRef } = useStatusViewTracking(status.id, shouldTrack);

  return (
    <div ref={elementRef} className="w-full flex items-center my-8">
      <hr className="flex-1 border-gray-300" />
      <div className="flex items-center -mt-6 px-2 min-w-0">
        <ReportStatusDisplay
          status={status.status}
          date={status.createdAt}
          className="shadow-none"
          userTimezone={userTimezone}
        />
      </div>
      <hr className="flex-1 border-gray-300" />
    </div>
  );
}
