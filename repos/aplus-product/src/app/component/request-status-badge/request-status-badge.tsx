import { ReportService } from "@/app/services/report/request.service";
import { ReportStatus } from "@/generated/prisma/enums";
import Badge from "@codegouvfr/react-dsfr/Badge";
export function ReportStatusBadge({
  status,
  small = false,
}: {
  status: ReportStatus | undefined;
  small?: boolean;
}) {
  if (!status) return null;
  //   Light/Options/Illustration/$color-950/Default/$purple-glycine-950
  // Tailwind 4 approach with CSS variables
  const statusColorMap = {
    [ReportStatus.PENDING_ASSIGNMENT]: {
      color: "#6E445A",
      backgroundColor: "#FEE7FC",
    },
    [ReportStatus.IN_TREATMENT]: {
      color: "#695240",
      backgroundColor: "#FEEBD0",
    },
    [ReportStatus.COMPLETED]: {
      color: "#297254",
      backgroundColor: "#C3FAD5",
    },
    [ReportStatus.CLOSED]: {
      color: "#2F4077",
      backgroundColor: "#E9EDFE",
    },
    [ReportStatus.DELETED]: {
      color: "red",
      backgroundColor: "red-primary-light",
    },
  } as const;

  const colorScheme = statusColorMap[status].color;
  const backgroundColor = statusColorMap[status].backgroundColor;

  return (
    <Badge
      noIcon
      small={small}
      data-testid="status-badge"
      data-status={status}
      className="whitespace-nowrap"
      style={{
        backgroundColor,
        color: colorScheme,
      }}
    >
      {ReportService.getLabelReport(status)}
    </Badge>
  );
}
