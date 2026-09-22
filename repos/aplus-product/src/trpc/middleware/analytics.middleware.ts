import { analytics } from "@/lib/analytics/analytics";
import type { BaseAnalyticsEvent } from "@/types/analytics";
import { getEventCategory, ANALYTICS_EVENTS } from "@/types/analytics";

interface TrackedMutationConfig {
  eventName: (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
  getMetadata: (input: unknown, result: unknown) => Record<string, unknown>;
}

// Mapping of tRPC paths to analytics events
export const TRACKED_MUTATIONS: Record<string, TrackedMutationConfig> = {
  // Report mutations
  "report.createReport": {
    eventName: ANALYTICS_EVENTS.REPORT_CREATED,
    getMetadata: (input: unknown) => {
      const typedInput = input as {
        area?: { value: string }[];
        requestedTeams?: { value: string }[];
        coAuthors?: { value: string }[];
      };
      return {
        areaId: typedInput.area?.[0]?.value ?? null,
        numTeams: typedInput.requestedTeams?.length ?? 0,
        numCoAuthors: typedInput.coAuthors?.length ?? 0,
      };
    },
  },
  "report.updateReportStatus": {
    eventName: ANALYTICS_EVENTS.REPORT_STATUS_CHANGED,
    getMetadata: (input: unknown, result: unknown) => {
      const typedInput = input as { id: string; status?: string };
      const typedResult = result as { status?: string };
      return {
        reportId: typedInput.id,
        // À la réouverture, le client n'envoie pas de statut : on lit le statut
        // réellement appliqué retourné par la mutation.
        newStatus: typedResult?.status ?? typedInput.status ?? null,
      };
    },
  },
  "report.addRequestedTeamsToReport": {
    eventName: ANALYTICS_EVENTS.REPORT_TEAMS_INVITED,
    getMetadata: (input: unknown) => {
      const typedInput = input as {
        reportId: string;
        teamIds: string[];
      };
      return {
        reportId: typedInput.reportId,
        teamIds: typedInput.teamIds,
      };
    },
  },
  "report.addCoAuthorsToReport": {
    eventName: ANALYTICS_EVENTS.REPORT_COLLEAGUES_INVITED,
    getMetadata: (input: unknown) => {
      const typedInput = input as {
        reportId: string;
        coAuthorIds: string[];
      };
      return {
        reportId: typedInput.reportId,
        colleagueIds: typedInput.coAuthorIds,
      };
    },
  },

  // Answer mutations
  "answer.createAnswer": {
    eventName: ANALYTICS_EVENTS.ANSWER_CREATED,
    getMetadata: (input: unknown, result: unknown) => {
      const typedInput = input as {
        reportId: string;
        isOperatorOnly?: boolean;
        newStatus?: string;
      };
      const typedResult = result as { id?: string };
      return {
        answerId: typedResult?.id ?? null,
        reportId: typedInput.reportId,
        isOperatorOnly: typedInput.isOperatorOnly ?? false,
        newReportStatus: typedInput.newStatus ?? null,
      };
    },
  },
  "answer.markAnswerAsViewed": {
    eventName: ANALYTICS_EVENTS.ANSWER_VIEWED,
    getMetadata: (input: unknown) => {
      const typedInput = input as { answerId: string; reportId?: string };
      return {
        answerId: typedInput.answerId,
        reportId: typedInput.reportId ?? null,
      };
    },
  },
  "answer.markAnswersAsViewed": {
    eventName: ANALYTICS_EVENTS.ANSWERS_BATCH_VIEWED,
    getMetadata: (input: unknown) => {
      const typedInput = input as { answerIds: string[]; reportId?: string };
      return {
        reportId: typedInput.reportId ?? null,
        count: typedInput.answerIds?.length ?? 0,
      };
    },
  },

  // User mutations
  "user.updateProfile": {
    eventName: ANALYTICS_EVENTS.USER_PROFILE_UPDATED,
    getMetadata: (input: unknown) => {
      const typedInput = input as Record<string, unknown>;
      const fieldsUpdated = Object.keys(typedInput).filter(
        (key) => typedInput[key] !== undefined,
      );
      return { fieldsUpdated };
    },
  },
  "user.updateUser": {
    eventName: ANALYTICS_EVENTS.USER_ADMIN_UPDATED,
    getMetadata: (input: unknown) => {
      const typedInput = input as {
        userId: string;
        email?: string;
      } & Record<string, unknown>;
      const fieldsUpdated = Object.keys(typedInput).filter(
        (key) => key !== "userId" && typedInput[key] !== undefined,
      );
      return {
        targetUserId: typedInput.userId,
        targetEmail: typedInput.email ?? null,
        fieldsUpdated,
      };
    },
  },
  "user.deactivateUser": {
    eventName: ANALYTICS_EVENTS.USER_DEACTIVATED,
    getMetadata: (input: unknown) => {
      const typedInput = input as { userId: string };
      return { targetUserId: typedInput.userId };
    },
  },
  "user.reactivateUser": {
    eventName: ANALYTICS_EVENTS.USER_REACTIVATED,
    getMetadata: (input: unknown) => {
      const typedInput = input as { userId: string };
      return { targetUserId: typedInput.userId };
    },
  },

  // Team mutations
  "team.createTeam": {
    eventName: ANALYTICS_EVENTS.TEAM_CREATED,
    getMetadata: (input: unknown, result: unknown) => {
      const typedInput = input as {
        organizationId: string;
        role?: string;
        areas?: unknown[];
      };
      const typedResult = result as { id?: string };
      return {
        teamId: typedResult?.id ?? null,
        organizationId: typedInput.organizationId,
        role: typedInput.role ?? "HELPER",
        numAreas: typedInput.areas?.length ?? 0,
      };
    },
  },
  "team.updateTeam": {
    eventName: ANALYTICS_EVENTS.TEAM_UPDATED,
    getMetadata: (input: unknown) => {
      const typedInput = input as { id: string } & Record<string, unknown>;
      const fieldsUpdated = Object.keys(typedInput).filter(
        (key) => key !== "id" && typedInput[key] !== undefined,
      );
      return {
        teamId: typedInput.id,
        fieldsUpdated,
      };
    },
  },
  "team.deleteTeam": {
    eventName: ANALYTICS_EVENTS.TEAM_DELETED,
    getMetadata: (input: unknown) => {
      const typedInput = input as { id: string; name?: string };
      return {
        teamId: typedInput.id,
        teamName: typedInput.name ?? null,
      };
    },
  },
  "team.addUserToTeam": {
    eventName: ANALYTICS_EVENTS.TEAM_MEMBER_ADDED,
    getMetadata: (input: unknown) => {
      const typedInput = input as {
        teamId: string;
        users?: Array<{ email: string; isManager: boolean }>;
      };
      const users = typedInput.users ?? [];
      return {
        teamId: typedInput.teamId,
        users: users.map((u) => ({ email: u.email, isManager: u.isManager })),
      };
    },
  },
  "team.removeUserFromTeam": {
    eventName: ANALYTICS_EVENTS.TEAM_MEMBER_REMOVED,
    getMetadata: (input: unknown) => {
      const typedInput = input as {
        teamId: string;
        userId: string;
        wasManager?: boolean;
      };
      return {
        teamId: typedInput.teamId,
        removedUserId: typedInput.userId,
        wasManager: typedInput.wasManager ?? false,
      };
    },
  },
};

interface RequestContext {
  userAgent: string | null;
  referrer: string | null;
  ipAddress: string | null;
  pagePath: string | null;
}

/**
 * Track an analytics event for a tRPC mutation
 */
export function trackMutationEvent(
  path: string,
  userId: string | null,
  input: unknown,
  result: unknown,
  requestContext?: RequestContext | null,
): void {
  const trackedMutation = TRACKED_MUTATIONS[path];

  if (!trackedMutation) return;

  try {
    const metadata = trackedMutation.getMetadata(input, result);

    const event: BaseAnalyticsEvent = {
      eventName: trackedMutation.eventName,
      eventCategory: getEventCategory(trackedMutation.eventName),
      userId: userId ?? null,
      metadata,
      occurredAt: new Date(),
      userAgent: requestContext?.userAgent ?? null,
      referrer: requestContext?.referrer ?? null,
      ipAddress: requestContext?.ipAddress ?? null,
      pagePath: requestContext?.pagePath ?? null,
    };

    // Fire and forget - don't await to avoid blocking the response
    void analytics
      .trackEvent(event)
      .then(() => analytics.flush())
      .catch((error) => {
        console.error(`[Analytics Middleware] Failed to track ${path}:`, error);
      });
  } catch (error) {
    console.error(`[Analytics Middleware] Failed to track ${path}:`, error);
  }
}
