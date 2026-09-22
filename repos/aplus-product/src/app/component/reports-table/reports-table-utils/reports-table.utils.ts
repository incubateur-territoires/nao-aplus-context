import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type Report =
  inferRouterOutputs<AppRouter>["report"]["getMyCreatedReportsTable"]["reports"][number];

/**
 * Formats a date to French format (e.g., "15 Jan 2024")
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "d MMM yyyy", { locale: fr });
}

/**
 * Returns the date of the last message (answer) for a report.
 * Falls back to report's updatedAt if no answers exist.
 */
export function getLastMessageDate(report: Report): Date | null {
  if (report.answers && report.answers.length > 0) {
    const latestAnswer = report.answers[0];
    return latestAnswer?.createdAt || null;
  }
  return report.updatedAt || null;
}
