import { formatToLongDate } from "@/utils/format";
import DOMPurify from "isomorphic-dompurify";

interface MetadataMessageProps {
  content: string;
  createdAt: Date;
  shouldShowOnlyHours: boolean;
  userTimezone: string;
}

export function MetadataMessage({
  content,
  createdAt,
  userTimezone,
}: MetadataMessageProps) {
  return (
    <div className="relative flex items-start gap-4 max-w-2xl pl-4">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-300" />
      <div className="flex-1 pt-2 pb-3">
        <div
          className="text-sm text-gray-700 leading-6"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
        />
        <p className="text-xs text-gray-500 mt-2 mb-0">
          {formatToLongDate(createdAt, userTimezone)}
        </p>
      </div>
    </div>
  );
}
