import { MessageBubble } from "../message-bubble/message-bubble";
import { AuthorInfo } from "../author-info/author-info";
import { STYLES } from "../styles";
import {
  getAuthorGroup,
  shouldShowOnlyTime,
  shouldShowAuthorInfo,
  getMessageSpacing,
} from "../utils";
import type { AnswerItemProps, AnswerType } from "../types";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { OrganizationRole } from "@/generated/prisma/enums";
import { useAnswerViewTracking } from "@/app/hooks/use-answer-view-tracking";

export function AnswerItem({
  answer,
  isAuthorAnswer,
  answers,
  currentIndex,
  hasStatusAfter,
  userTimezone,
}: AnswerItemProps) {
  const { data: session } = useSession();
  const trpc = useTRPC();

  // Get current user with teams to check team roles
  const { data: currentUser } = useQuery(
    trpc.user.getCurrentUser.queryOptions(undefined, {
      enabled: !!session?.user,
    }),
  );

  // Check if user has any team with HELPER role (helpers can't see operator-only messages)
  const isHelperUserRole = currentUser?.teams?.some(
    (team) => team.role === OrganizationRole.HELPER,
  );

  // Track answer views (only if user is not the author)
  const shouldTrack = !isAuthorAnswer && !!currentUser;
  const { elementRef } = useAnswerViewTracking(answer.id, shouldTrack);

  // If the answer is operator only and the user is a helper, don't show the answer
  if (isHelperUserRole && answer.isOperatorOnly) {
    return null;
  }

  // Function to check if a message is visible to the current user
  function isMessageVisible(answer: AnswerType): boolean {
    // Helpers cannot see operator-only messages
    if (isHelperUserRole && answer.isOperatorOnly) {
      return false;
    }
    return true;
  }

  const shouldShowOnlyHours = shouldShowOnlyTime(answer, answers, currentIndex);
  const showAuthorInfo =
    shouldShowAuthorInfo(answer, answers, currentIndex, isMessageVisible) ||
    hasStatusAfter;
  const messageSpacing = getMessageSpacing(answer, answers, currentIndex);
  const authorGroup = getAuthorGroup(answer);
  const messageBackgroundClass = answer.isOperatorOnly
    ? STYLES.instructorOnlyBg
    : isAuthorAnswer
      ? STYLES.authorBg
      : STYLES.helperBg;
  const alignmentClass = isAuthorAnswer ? "justify-end" : "justify-start";
  const textAlignmentClass = isAuthorAnswer ? "text-right" : "text-left";
  const authorInfoClass = isAuthorAnswer ? "flex-row-reverse" : "";

  // Center metadata messages
  if (answer.isMetadataOnly) {
    return (
      <div
        id={`answer-${answer.id}`}
        ref={elementRef}
        className={`w-full flex ${messageSpacing}`}
      >
        <div className="flex justify-start w-full pl-[15%]">
          <MessageBubble
            answer={answer}
            backgroundClass={messageBackgroundClass}
            shouldShowOnlyHours={shouldShowOnlyHours}
            userTimezone={userTimezone}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      id={`answer-${answer.id}`}
      ref={elementRef}
      className={`w-full flex ${messageSpacing}`}
    >
      <div className={`flex ${alignmentClass} w-full`}>
        <div className="flex flex-col md:max-w-2/3 md:min-w-2/3 max-w-full min-w-full">
          <div
            className={
              isAuthorAnswer ? "md:mr-20 mr-0 ml-0" : "md:ml-20 ml-0 mr-0"
            }
          >
            <MessageBubble
              answer={answer}
              backgroundClass={messageBackgroundClass}
              shouldShowOnlyHours={shouldShowOnlyHours}
              userTimezone={userTimezone}
            />
          </div>
          {showAuthorInfo && (
            <AuthorInfo
              answer={answer}
              authorGroup={authorGroup}
              textAlignmentClass={textAlignmentClass}
              authorInfoClass={authorInfoClass}
              isAuthorAnswer={isAuthorAnswer}
            />
          )}
        </div>
      </div>
    </div>
  );
}
