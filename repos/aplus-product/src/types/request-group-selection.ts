import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

// Both API endpoints return the same structure with organization.tags and organization.specificFields
type TeamFromReport =
  inferRouterOutputs<AppRouter>["team"]["getNotInvitedTeamsByReportId"][number];
type TeamFromArea =
  inferRouterOutputs<AppRouter>["team"]["getActiveOperatorTeamsByAreaIds"][number];

// Union type that works for both endpoints (they have identical structure)
export type TeamWithIncludes = TeamFromReport | TeamFromArea;

export type TeamWithTags = TeamWithIncludes & {
  tags: {
    label: string[];
    value: string[];
  };
};
