"use client";

import { ReportStatus } from "@/generated/prisma/enums";
import Button from "@codegouvfr/react-dsfr/Button";
import Tag from "@codegouvfr/react-dsfr/Tag";
import { ReportService } from "@/app/services/report/request.service";
import { useHydrated } from "@/app/hooks/use-hydrated";

interface ReportsTableStatusFilterProps {
  allStatuses: ReportStatus[];
  selectedStatuses: ReportStatus[];
  onStatusFilterChange: (statuses: ReportStatus[]) => void;
  // id de l'indication commune fournie par le parent (unique par instance).
  hintId?: string;
}

export function ReportsTableStatusFilter({
  allStatuses,
  selectedStatuses,
  onStatusFilterChange,
  hintId,
}: ReportsTableStatusFilterProps) {
  const isHydrated = useHydrated();

  function handleStatusToggle(status: ReportStatus) {
    if (selectedStatuses.includes(status)) {
      onStatusFilterChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusFilterChange([...selectedStatuses, status]);
    }
  }

  if (allStatuses.length <= 1) return null;

  // Render tags only after hydration to avoid DSFR data-fr-js-toggle mismatch
  if (!isHydrated) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm m-0">Par état :</p>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      role="group"
      aria-label="Filtrer par état"
      aria-describedby={hintId}
    >
      <p className="text-sm m-0">Par état :</p>

      {allStatuses.map((status) => (
        <Tag
          key={status}
          pressed={selectedStatuses.includes(status)}
          nativeButtonProps={{
            onClick: (e) => {
              e.preventDefault();
              handleStatusToggle(status);
            },
          }}
        >
          {ReportService.getLabelReport(status)}
        </Tag>
      ))}
      {selectedStatuses.length > 0 && (
        <Button
          type="button"
          size="small"
          priority="tertiary no outline"
          className="text-sm underline underline-offset-8 text-blue-primary p-0 bg-transparent"
          onClick={() => {
            onStatusFilterChange([]);
          }}
        >
          Réinitialiser les filtres
        </Button>
      )}
    </div>
  );
}
