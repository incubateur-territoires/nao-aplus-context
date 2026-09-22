import { ROUTE } from "@/app/constant/route";

export function buildReportUrl(reportId: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}${ROUTE.REPORT}/${reportId}`;
}
