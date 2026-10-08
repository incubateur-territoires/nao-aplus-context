"use client";

import { useRouter } from "next/navigation";
import Select from "@codegouvfr/react-dsfr/Select";
import ToggleSwitch from "@codegouvfr/react-dsfr/ToggleSwitch";
import {
  ANONYMIZED_REPORT_FILTER_OPTIONS,
  anonymizedReportsHref,
  type AnonymizedReportSearch,
} from "@/utils/anonymized-report";
import type { AnonymizedReportOperator } from "@/types/anonymized-report";
import { stripEmptyAriaDescribedBy } from "@/utils/dsfr-select-a11y";
import type { GoldenTagAxis } from "@/utils/golden-dataset-golden-tags";

interface AnonymizedReportFiltersProps {
  search: AnonymizedReportSearch;
  operators: AnonymizedReportOperator[];
}

function labelOptions(axis: GoldenTagAxis) {
  const { main, others } = ANONYMIZED_REPORT_FILTER_OPTIONS[axis];

  return (
    <>
      {main.map((label) => (
        <option key={label} value={label}>
          {label}
        </option>
      ))}
      {others.length > 0 && (
        <optgroup label="Autres">
          {others.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}

export function AnonymizedReportFilters({
  search,
  operators,
}: AnonymizedReportFiltersProps) {
  const router = useRouter();

  function applyFilters(
    filters: Partial<
      Pick<
        AnonymizedReportSearch,
        "operator" | "includeUntagged" | "procedureLabel" | "blockageLabel"
      >
    >,
  ) {
    router.push(
      anonymizedReportsHref({
        page: 1,
        operator: search.operator,
        includeUntagged: search.includeUntagged,
        procedureLabel: search.procedureLabel,
        blockageLabel: search.blockageLabel,
        ...filters,
      }),
    );
  }

  return (
    <div className="bg-white p-4 mb-6 grid gap-6 md:grid-cols-3">
      <ToggleSwitch
        className="md:col-span-3 [&_label]:!w-fit [&_label]:!max-w-full"
        showCheckedHint={false}
        checked={!search.includeUntagged}
        onChange={(checked) =>
          applyFilters({ includeUntagged: !checked || undefined })
        }
        label="Voir uniquement les signalements étiquetés"
      />
      <Select
        label="Opérateur"
        className="mb-0!"
        nativeSelectProps={{
          ref: stripEmptyAriaDescribedBy,
          value: search.operator ?? "",
          onChange: (event) =>
            applyFilters({ operator: event.target.value || undefined }),
        }}
      >
        <option value="">Tous</option>
        {operators.map((operator) => (
          <option key={operator.shortName} value={operator.shortName}>
            {operator.shortName}
          </option>
        ))}
      </Select>
      <Select
        label="Démarche"
        className="mb-0!"
        nativeSelectProps={{
          ref: stripEmptyAriaDescribedBy,
          value: search.procedureLabel ?? "",
          onChange: (event) =>
            applyFilters({ procedureLabel: event.target.value || undefined }),
        }}
      >
        <option value="">Toutes</option>
        {labelOptions("procedureTag")}
      </Select>
      <Select
        label="Blocage"
        className="mb-0!"
        nativeSelectProps={{
          ref: stripEmptyAriaDescribedBy,
          value: search.blockageLabel ?? "",
          onChange: (event) =>
            applyFilters({ blockageLabel: event.target.value || undefined }),
        }}
      >
        <option value="">Tous</option>
        {labelOptions("blockageTag")}
      </Select>
    </div>
  );
}
