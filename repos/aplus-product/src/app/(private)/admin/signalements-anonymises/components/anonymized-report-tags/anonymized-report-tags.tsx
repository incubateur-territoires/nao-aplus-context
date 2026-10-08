import Badge from "@codegouvfr/react-dsfr/Badge";
import type { GoldenTagAxis } from "@/utils/golden-dataset-golden-tags";
import type { DisplayedTagging } from "@/utils/anonymized-report";

interface AnonymizedReportTagsProps extends DisplayedTagging {
  small?: boolean;
  className?: string;
}

const AXIS_NAME: Record<GoldenTagAxis, string> = {
  procedureTag: "Démarche",
  blockageTag: "Blocage",
};

const AXIS_COLOR: Record<GoldenTagAxis, string> = {
  procedureTag: "fr-badge--blue-ecume",
  blockageTag: "fr-badge--purple-glycine",
};

export function AnonymizedReportTags({
  procedureLabel,
  blockageLabel,
  small = false,
  className,
}: AnonymizedReportTagsProps) {
  const axes: [GoldenTagAxis, string | null][] = [
    ["procedureTag", procedureLabel],
    ["blockageTag", blockageLabel],
  ];
  const badges = axes.flatMap(([axis, label]) =>
    label === null ? [] : [{ axis, label }],
  );

  if (badges.length === 0) {
    return null;
  }

  return (
    <ul className={`fr-badges-group ${className ?? ""}`}>
      {badges.map(({ axis, label }) => (
        <li key={axis}>
          <span className="fr-sr-only">{AXIS_NAME[axis]} : </span>
          <Badge small={small} className={AXIS_COLOR[axis]}>
            {label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
