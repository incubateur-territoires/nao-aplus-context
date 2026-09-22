"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import { Tag } from "@codegouvfr/react-dsfr/Tag";

interface FiltersProps {
  selectedFilters: string[];
  setSelectedFilters: (filters: string[]) => void;
  tags: {
    label: string;
    value: string;
  }[];
}

export function Filters({
  selectedFilters,
  setSelectedFilters,
  tags,
}: FiltersProps) {
  function handleFilterClick(filter: string) {
    setSelectedFilters(
      selectedFilters.includes(filter)
        ? selectedFilters.filter((f) => f !== filter)
        : [...selectedFilters, filter],
    );
  }

  return (
    <div
      className="flex gap-4 flex-wrap items-baseline"
      data-testid="request-group-filters"
    >
      <p id="request-group-filters-hint" className="sr-only">
        Les résultats se mettent à jour automatiquement à l&apos;activation
        d&apos;un filtre.
      </p>
      <p className="text-sm !m-0">Filtrer par :</p>
      {tags.map((filter) => (
        <Tag
          key={filter.value}
          pressed={selectedFilters.includes(filter.value)}
          nativeButtonProps={{
            onClick: (e) => {
              e.preventDefault();
              handleFilterClick(filter.value);
            },
          }}
        >
          {filter.label}
        </Tag>
      ))}
      <Button
        data-testid="request-group-filters-reset"
        type="button"
        size="small"
        priority="tertiary no outline"
        className={`text-sm underline underline-offset-8  text-blue-primary !p-0 !bg-transparent ${
          selectedFilters.length > 0 ? "block" : "!hidden"
        }`}
        onClick={() => {
          setSelectedFilters([]);
        }}
      >
        Réinitialiser les filtres
      </Button>
    </div>
  );
}
