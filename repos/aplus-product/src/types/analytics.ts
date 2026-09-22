// Event categories for grouping
export const EVENT_CATEGORIES = {
  PAGE_VIEW: "page_view",
  AUTH: "auth",
  REPORT: "report",
  ANSWER: "answer",
  FILE: "file",
  USER: "user",
  TEAM: "team",
  SEARCH: "search",
} as const;

export type EventCategory =
  (typeof EVENT_CATEGORIES)[keyof typeof EVENT_CATEGORIES];

// Type-safe event definitions
export const ANALYTICS_EVENTS = {
  // Authentication events
  AUTH_SIGN_IN: "auth_sign_in",
  AUTH_SIGN_IN_FAILED: "auth_sign_in_failed",
  AUTH_SIGN_OUT: "auth_sign_out",
  AUTH_REGISTRATION_COMPLETE: "auth_registration_complete",
  AUTH_ACCOUNT_CREATED: "auth_account_created",
  AUTH_IMPERSONATE_USER: "auth_impersonate_user",
  AUTH_STOP_IMPERSONATION: "auth_stop_impersonation",
  AUTH_PASSWORD_RESET_REQUESTED: "auth_password_reset_requested",
  AUTH_PASSWORD_RESET_COMPLETED: "auth_password_reset_completed",

  // Report events
  REPORT_CREATED: "report_created",
  REPORT_VIEWED: "report_viewed",
  REPORT_STATUS_CHANGED: "report_status_changed",
  REPORT_TEAMS_INVITED: "report_teams_invited",
  REPORT_COLLEAGUES_INVITED: "report_colleagues_invited",

  // Answer events
  ANSWER_CREATED: "answer_created",
  ANSWER_VIEWED: "answer_viewed",
  ANSWERS_BATCH_VIEWED: "answers_batch_viewed",

  // File events
  FILE_UPLOADED: "file_uploaded",
  FILE_DOWNLOADED: "file_downloaded",

  // User events
  USER_PROFILE_UPDATED: "user_profile_updated",
  USER_ADMIN_UPDATED: "user_admin_updated",
  USER_DEACTIVATED: "user_deactivated",
  USER_REACTIVATED: "user_reactivated",

  // Team events
  TEAM_CREATED: "team_created",
  TEAM_UPDATED: "team_updated",
  TEAM_DELETED: "team_deleted",
  TEAM_MEMBER_ADDED: "team_member_added",
  TEAM_MEMBER_REMOVED: "team_member_removed",
  TEAM_VIEWED: "team_viewed",

  // Page view events
  PAGE_VIEW: "page_view",

  // Search events
  TEAMS_SEARCHED: "teams_searched",
  USERS_SEARCHED: "users_searched",
  REPORTS_SEARCHED: "reports_searched",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// Base event interface
export interface BaseAnalyticsEvent {
  eventName: AnalyticsEventName;
  eventCategory: EventCategory;
  userId?: string | null;
  sessionId?: string | null;
  pageUrl?: string | null;
  pagePath?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown> | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  occurredAt?: Date | null;
}

// Specific event metadata types
export interface AuthSignInMetadata {
  method: "email" | "sso";
}

export interface AuthSignInFailedMetadata {
  method: "email" | "totp" | "backup-code";
  email?: string;
  reason?: string;
}

export interface AuthImpersonateMetadata {
  targetUserId: string;
  targetEmail: string;
}

export interface AuthPasswordResetRequestedMetadata {
  email: string;
}

export interface AuthRegistrationCompleteMetadata {
  hasPhone: boolean;
  hasProfession: boolean;
}

export interface ReportCreatedMetadata {
  reportId: string;
  areaId: string;
  numFiles: number;
  numTeams: number;
  numCoAuthors: number;
  hasNir: boolean;
  hasCaf: boolean;
  hasNif: boolean;
}

export interface ReportViewedMetadata {
  reportId: string;
  status: string;
}

export interface ReportStatusChangedMetadata {
  reportId: string;
  oldStatus: string;
  newStatus: string;
}

export interface ReportTeamsInvitedMetadata {
  reportId: string;
  teamIds: string[];
}

export interface ReportColleaguesInvitedMetadata {
  reportId: string;
  colleagueIds: string[];
}

export interface AnswerCreatedMetadata {
  answerId: string;
  reportId: string;
  isOperatorOnly: boolean;
  hasFiles: boolean;
  newReportStatus?: string;
}

export interface AnswerViewedMetadata {
  answerId: string;
  reportId: string;
}

export interface AnswersBatchViewedMetadata {
  reportId: string;
  count: number;
}

export interface FileUploadedMetadata {
  fileId: string;
  fileSize: number;
  fileType: string;
}

export interface FileDownloadedMetadata {
  fileId: string;
}

export interface UserProfileUpdatedMetadata {
  fieldsUpdated: string[];
}

export interface UserAdminUpdatedMetadata {
  targetUserId: string;
  targetEmail: string;
  fieldsUpdated: string[];
}

export interface UserDeactivatedMetadata {
  targetUserId: string;
}

export interface UserReactivatedMetadata {
  targetUserId: string;
}

export interface TeamCreatedMetadata {
  teamId: string;
  organizationId: string;
  role: string;
  numAreas: number;
}

export interface TeamUpdatedMetadata {
  teamId: string;
  fieldsUpdated: string[];
}

export interface TeamDeletedMetadata {
  teamId: string;
  teamName: string;
}

export interface TeamMemberAddedMetadata {
  teamId: string;
  numAdded: number;
  numManagersAssigned: number;
}

export interface TeamMemberRemovedMetadata {
  teamId: string;
  removedUserId: string;
  wasManager: boolean;
}

export interface TeamViewedMetadata {
  teamId: string;
}

export interface PageViewMetadata {
  pageTitle?: string;
  previousPath?: string;
}

export interface SearchMetadata {
  query: string;
  resultsCount: number;
  filters?: Record<string, unknown>;
}

// Event type mapping for type-safe metadata
export interface AnalyticsEventMetadataMap {
  auth_sign_in: AuthSignInMetadata;
  auth_sign_in_failed: AuthSignInFailedMetadata;
  auth_sign_out: Record<string, never>;
  auth_registration_complete: AuthRegistrationCompleteMetadata;
  auth_account_created: Record<string, never>;
  auth_impersonate_user: AuthImpersonateMetadata;
  auth_stop_impersonation: Record<string, never>;
  auth_password_reset_requested: AuthPasswordResetRequestedMetadata;
  auth_password_reset_completed: Record<string, never>;
  report_created: ReportCreatedMetadata;
  report_viewed: ReportViewedMetadata;
  report_status_changed: ReportStatusChangedMetadata;
  report_teams_invited: ReportTeamsInvitedMetadata;
  report_colleagues_invited: ReportColleaguesInvitedMetadata;
  answer_created: AnswerCreatedMetadata;
  answer_viewed: AnswerViewedMetadata;
  answers_batch_viewed: AnswersBatchViewedMetadata;
  file_uploaded: FileUploadedMetadata;
  file_downloaded: FileDownloadedMetadata;
  user_profile_updated: UserProfileUpdatedMetadata;
  user_admin_updated: UserAdminUpdatedMetadata;
  user_deactivated: UserDeactivatedMetadata;
  user_reactivated: UserReactivatedMetadata;
  team_created: TeamCreatedMetadata;
  team_updated: TeamUpdatedMetadata;
  team_deleted: TeamDeletedMetadata;
  team_member_added: TeamMemberAddedMetadata;
  team_member_removed: TeamMemberRemovedMetadata;
  team_viewed: TeamViewedMetadata;
  page_view: PageViewMetadata;
  teams_searched: SearchMetadata;
  users_searched: SearchMetadata;
  reports_searched: SearchMetadata;
}

// Helper function to get category from event name
export function getEventCategory(eventName: AnalyticsEventName): EventCategory {
  if (eventName === "page_view") return EVENT_CATEGORIES.PAGE_VIEW;
  if (eventName.startsWith("auth_")) return EVENT_CATEGORIES.AUTH;
  if (eventName.startsWith("report_")) return EVENT_CATEGORIES.REPORT;
  if (eventName.startsWith("answer")) return EVENT_CATEGORIES.ANSWER;
  if (eventName.startsWith("file_")) return EVENT_CATEGORIES.FILE;
  if (eventName.startsWith("user_")) return EVENT_CATEGORIES.USER;
  if (eventName.startsWith("team_")) return EVENT_CATEGORIES.TEAM;
  if (eventName.endsWith("_searched")) return EVENT_CATEGORIES.SEARCH;
  return EVENT_CATEGORIES.PAGE_VIEW;
}
