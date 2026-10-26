import type { ReportStatus } from "@/generated/prisma/enums";

export const QUICK_SEARCH_KINDS = {
  PAGE: "page",
  REPORT: "report",
  USER: "user",
  TEAM: "team",
} as const;

export type QuickSearchKind =
  (typeof QUICK_SEARCH_KINDS)[keyof typeof QUICK_SEARCH_KINDS];

export interface QuickSearchItem {
  kind: QuickSearchKind;
  id: string;
  label: string;
  detail?: string;
  href: string;
  status?: ReportStatus;
}
