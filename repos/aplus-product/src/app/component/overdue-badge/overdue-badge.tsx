import Badge from "@codegouvfr/react-dsfr/Badge";

export function OverdueBadge({
  overdueAt,
  small = false,
}: {
  overdueAt: Date | null;
  small?: boolean;
}) {
  if (!overdueAt) return null;

  return (
    <Badge
      noIcon
      small={small}
      data-testid="overdue-badge"
      className="whitespace-nowrap"
      style={{
        backgroundColor: "#FFE9E9",
        color: "#CE0500",
      }}
    >
      En souffrance
    </Badge>
  );
}
