"use client";

import Alert from "@codegouvfr/react-dsfr/Alert";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Button from "@codegouvfr/react-dsfr/Button";
import {
  GOLDEN_TAG_AXES,
  type GoldenTagAxis,
} from "@/utils/golden-dataset-golden-tags";
import {
  MIN_ITEMS_PER_TAG,
  type ClosedTaxonomyReport,
} from "@/utils/golden-dataset-taxonomy";

const TITLE = "Taxonomie fermée";
const UNMAPPED_TITLE = "Labels sans entrée";
const UNADJUDICATED_TITLE = "Signalements non adjugés";
const BELOW_MINIMUM = `moins de ${MIN_ITEMS_PER_TAG}`;

const AXIS_LABELS: Record<GoldenTagAxis, string> = {
  blockageTag: "Blocage",
  procedureTag: "Démarche",
};

interface GoldenDatasetClosedTaxonomyProps {
  /** Calculé une fois par le parent, comme l'accord : la section ne dérive rien. */
  report: ClosedTaxonomyReport;
  total: number;
  isFreezing: boolean;
  freezeError: string | null;
  onFreeze: () => void;
}

export function GoldenDatasetClosedTaxonomy({
  report,
  total,
  isFreezing,
  freezeError,
  onFreeze,
}: GoldenDatasetClosedTaxonomyProps) {
  const frozen = report.frozenRows > 0;
  const drifted = [...report.items.values()].filter(
    (item) => item.driftedAxes.length > 0,
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-xl">{`${TITLE} v${report.version}`}</h2>

      {/* Un état stable n'est pas une alerte : le réserver aux `Alert` DSFR
          évite d'annoncer la section à chaque rendu. */}
      <p className="m-0 text-sm text-[#666]">
        {frozen
          ? `Figée : ${report.frozenRows}/${total} signalements.`
          : "Aperçu dérivé des labels de référence ; rien n'est écrit."}
      </p>

      {drifted.length > 0 && (
        <Alert
          small
          severity="warning"
          description={`${drifted.length} signalement(s) ont dérivé depuis le gel : signalements ${drifted.map((item) => item.position).join(", ")}.`}
        />
      )}

      {!report.corpus.ok && report.corpus.unmapped.length > 0 && (
        <div>
          <h3 className="m-0 text-base">{UNMAPPED_TITLE}</h3>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-sm">
            {report.corpus.unmapped.map((label) => (
              <li key={`${label.axis}-${label.fineLabel}`}>
                {`« ${label.fineLabel} » (${AXIS_LABELS[label.axis]}) : signalements ${label.positions.join(", ")}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!report.corpus.ok && report.corpus.unadjudicated.length > 0 && (
        <p className="m-0 text-sm">
          {`${UNADJUDICATED_TITLE} : ${report.corpus.unadjudicated.join(", ")}`}
        </p>
      )}

      <div className="flex flex-wrap gap-8">
        {GOLDEN_TAG_AXES.map((axis) => (
          <div key={axis}>
            <h3 className="m-0 text-base">{AXIS_LABELS[axis]}</h3>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-sm">
              {report.distribution[axis].map((entry) => (
                <li key={entry.tag} className="flex items-center gap-2">
                  <span>{entry.tag}</span>
                  <span className="text-[#666]">{entry.count}</span>
                  {entry.belowMinimum && (
                    <Badge small severity="warning">
                      {BELOW_MINIMUM}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <Button
          type="button"
          priority="secondary"
          disabled={frozen || !report.corpus.ok || isFreezing}
          onClick={onFreeze}
        >
          {`Figer la v${report.version}`}
        </Button>
      </div>

      {freezeError !== null && (
        <p role="alert" className="fr-error-text m-0">
          {freezeError}
        </p>
      )}
    </section>
  );
}
