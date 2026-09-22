import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

export type AnswersWithHistory =
  inferRouterOutputs<AppRouter>["answer"]["getAnswersWithStatusHistory"];
export type AnswerType = AnswersWithHistory["answers"][number];
export type AnswersType = AnswersWithHistory["answers"];
export type ReportStatusHistoryType =
  AnswersWithHistory["statusHistory"][number] & {
    answerId?: string | null;
  };

export type TimelineAnswerItem = {
  kind: "answer";
  answer: AnswerType;
  index: number;
  hasStatusAfter?: boolean;
};

export type TimelineItem =
  | TimelineAnswerItem
  | { kind: "status"; status: ReportStatusHistoryType };

/**
 * Étape de l'évolution du signalement : un changement de statut (ou `null` pour
 * les messages antérieurs au premier statut) et les messages qui lui sont
 * rattachés.
 */
export interface TimelineGroup {
  status: ReportStatusHistoryType | null;
  answers: TimelineAnswerItem[];
}

export interface AnswerItemProps {
  answer: AnswerType;
  isAuthorAnswer: boolean;
  answers?: AnswersType;
  currentIndex?: number;
  hasStatusAfter?: boolean;
  userTimezone: string;
}

export interface MessageBubbleProps {
  answer: AnswerType;
  backgroundClass: string;
  shouldShowOnlyHours: boolean;
  userTimezone: string;
}

export interface AuthorInfoProps {
  answer: AnswerType;
  authorGroup: AnswerType["author"]["teams"][0] | undefined;
  textAlignmentClass: string;
  authorInfoClass: string;
  isAuthorAnswer: boolean;
}

export interface HelperAvatarProps {
  isAuthorAnswer: boolean;
  isOperatorOnly: boolean;
}

export interface StatusTimelineEntryProps {
  status: ReportStatusHistoryType;
  userTimezone: string;
}
