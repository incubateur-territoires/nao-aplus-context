import { NotificationFrequency } from "@/generated/prisma/enums";

export interface DigestContent {
  unviewedReportsCount: number;
  unviewedAnswersCount: number;
  unviewedStatusChangesCount: number;
}

export interface UserDigestEligibility {
  userId: string;
  email: string;
  firstName: string;
  timezone: string;
  lastDigestSentAt: Date | null;
  notificationFrequency: NotificationFrequency;
}

export interface DigestProcessResult {
  usersProcessed: number;
  emailsSent: number;
  usersSkipped: number;
  errors: Array<{ userId: string; error: string }>;
}

export interface DigestEmailParams {
  userFirstName: string;
  linkUrl: string;
  reportsText: string;
  answersText: string;
  statusText: string;
}
