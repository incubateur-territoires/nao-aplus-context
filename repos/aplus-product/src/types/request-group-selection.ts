import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

export type TeamWithIncludes =
  inferRouterOutputs<AppRouter>["team"]["getActiveOperatorTeamsByAreaIds"][number];

export type TeamWithTags = TeamWithIncludes & {
  tags: {
    label: string[];
    value: string[];
  };
};
