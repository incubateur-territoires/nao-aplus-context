import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type AnonymizedReportOutputs =
  inferRouterOutputs<AppRouter>["anonymizedReport"];

export type AnonymizedReportPage = AnonymizedReportOutputs["list"];
export type AnonymizedReportListItem = AnonymizedReportPage["items"][number];
export type AnonymizedReportDetail = AnonymizedReportOutputs["getById"];
export type AnonymizedReportOperator =
  AnonymizedReportOutputs["operators"][number];
