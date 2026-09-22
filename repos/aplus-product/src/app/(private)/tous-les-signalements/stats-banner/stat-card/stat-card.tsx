"use client";

interface StatCardProps {
  value: number;
  label: string;
  variant?: "default" | "overdue";
  onClick?: () => void;
}

// Couleur du chiffre : noir si 0, sinon bleu (ou rouge pour « en souffrance »).
function getValueColor(value: number, variant: "default" | "overdue"): string {
  if (value === 0) return "#161616";
  return variant === "overdue" ? "#CE0500" : "#000091";
}

export function StatCard({
  value,
  label,
  variant = "default",
  onClick,
}: StatCardProps) {
  const color = getValueColor(value, variant);

  const content = (
    <div className="flex flex-col gap-3 p-6 w-full">
      <div className="flex flex-col gap-2 break-words">
        <span
          className="font-bold text-[40px] leading-[48px]"
          style={{ color }}
        >
          {value}
        </span>
        <span className="text-sm leading-6 text-[#3a3a3a]">{label}</span>
      </div>
      {onClick && (
        <div className="flex justify-end pt-1">
          <span
            className="fr-icon-arrow-right-line text-[#000091]"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );

  const baseClassName =
    "bg-white border border-[#dddddd] flex flex-col flex-1 min-w-0 text-left";

  if (!onClick) {
    return <div className={baseClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${value} ${label}, voir le tableau filtré`}
      className={`${baseClassName} cursor-pointer transition-colors hover:bg-[#f6f6f6] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#0a76f6]`}
    >
      {content}
    </button>
  );
}
