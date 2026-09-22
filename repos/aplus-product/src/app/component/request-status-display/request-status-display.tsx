import { ReportStatus } from "@/generated/prisma/enums";
import { ReportStatusBadge } from "../request-status-badge/request-status-badge";
import { OverdueBadge } from "../overdue-badge/overdue-badge";
import { formatToLongDate } from "@/utils/format";

interface ReportStatusDisplayProps {
  status: ReportStatus | undefined;
  overdueAt?: Date | null;
  className?: string;
  date?: Date;
  userTimezone?: string;
}

export function ReportStatusDisplay({
  status,
  overdueAt = null,
  className = "",
  date,
  userTimezone = "Europe/Paris",
}: ReportStatusDisplayProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1  ${className} bg-white`}
    >
      <span className="text-sm font-medium text-gray-700 text-center">
        {date ? formatToLongDate(date, userTimezone) : "État du signalement :"}
      </span>
      <ReportStatusBadge status={status} />
      <OverdueBadge overdueAt={overdueAt} />
    </div>
  );
}
