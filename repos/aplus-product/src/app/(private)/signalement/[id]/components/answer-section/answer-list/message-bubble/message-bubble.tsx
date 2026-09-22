import { formatToLongDate, onlyHours } from "@/utils/format";
import { FileItem } from "@/app/component/file-item/file-item";
import { STYLES } from "../styles";
import { MetadataMessage } from "../metadata-message/metadata-message";
import type { MessageBubbleProps } from "../types";

function InstructorOnlyNotice() {
  return (
    <div className={STYLES.instructorNotice}>
      <i className="ri-information-line text-blue-primary" />
      <p className="text-xs m-0">
        Message visible uniquement par les opérateurs
      </p>
    </div>
  );
}

export function MessageBubble({
  answer,
  backgroundClass,
  shouldShowOnlyHours,
  userTimezone,
}: MessageBubbleProps) {
  if (answer.isMetadataOnly) {
    return (
      <MetadataMessage
        content={answer.content}
        createdAt={new Date(answer.createdAt)}
        shouldShowOnlyHours={shouldShowOnlyHours}
        userTimezone={userTimezone}
      />
    );
  }

  if (answer.isOperatorOnly) {
    return (
      <div className={`${backgroundClass} ${STYLES.messageContainer} `}>
        <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-1 sm:gap-4">
          <div className="flex-1 min-w-0">
            <InstructorOnlyNotice />
            <p className={`${STYLES.messageText} mt-2`}>{answer.content}</p>
          </div>
          <p className={STYLES.timestamp}>
            {shouldShowOnlyHours
              ? onlyHours(new Date(answer.createdAt), userTimezone)
              : formatToLongDate(new Date(answer.createdAt), userTimezone)}
          </p>
        </div>

        {answer.files?.length > 0 && (
          <div className={STYLES.filesContainer}>
            {answer.files.map((file) => (
              <FileItem key={file.id} file={file} color="blue" />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${backgroundClass} ${STYLES.messageContainer}`}>
      <div className={STYLES.messageContent}>
        <p className={STYLES.messageText}>{answer.content}</p>
        <p className={STYLES.timestamp}>
          {shouldShowOnlyHours
            ? onlyHours(new Date(answer.createdAt), userTimezone)
            : formatToLongDate(new Date(answer.createdAt), userTimezone)}
        </p>
      </div>

      {answer.files?.length > 0 && (
        <div className={STYLES.filesContainer}>
          {answer.files.map((file) => (
            <FileItem key={file.id} file={file} color="blue" />
          ))}
        </div>
      )}
    </div>
  );
}
