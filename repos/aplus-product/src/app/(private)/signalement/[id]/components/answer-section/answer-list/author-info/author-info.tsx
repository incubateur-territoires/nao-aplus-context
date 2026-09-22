import { STYLES } from "../styles";
import { HelperAvatar } from "../helper-avatar/helper-avatar";
import type { AuthorInfoProps } from "../types";
import { UserLink } from "../../../user-link/user-link";

export function AuthorInfo({
  answer,
  authorGroup,
  textAlignmentClass,
  authorInfoClass,
  isAuthorAnswer,
}: AuthorInfoProps) {
  return (
    <div className={`${STYLES.authorInfo} ${authorInfoClass}`}>
      <div>
        <HelperAvatar
          isAuthorAnswer={isAuthorAnswer}
          isOperatorOnly={answer.isOperatorOnly}
        />
      </div>
      <div className={textAlignmentClass}>
        <p className={STYLES.authorName}>
          {answer.author ? (
            <UserLink
              userId={answer.author.id}
              firstName={answer.author.firstName}
              lastName={answer.author.lastName}
            />
          ) : (
            "Utilisateur inconnu"
          )}
        </p>
        {authorGroup?.name && (
          <p className={STYLES.groupName}>({authorGroup.name})</p>
        )}
      </div>
    </div>
  );
}
