"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import Tag from "@codegouvfr/react-dsfr/Tag";
import { useAutocompleteSpaceToggle } from "@/app/hooks/use-autocomplete-space-toggle";
import {
  SELECT_ALL_ID,
  autocompleteFilledTextFieldSx,
  autocompleteOptionFocusSx,
  clearIndicatorA11yProps,
  popupIndicatorA11yProps,
  createSpaceInsensitiveFilter,
} from "@/utils/autocomplete-a11y";

interface OptionWithId {
  id: string;
}

interface MultiSelectAutocompleteProps<T extends OptionWithId> {
  id: string;
  label?: string;
  placeholder: string;
  options: T[];
  value: string[];
  onChange: (ids: string[]) => void;
  getOptionLabel: (option: T) => string;
  renderOptionContent?: (option: T) => ReactNode;
  noOptionsText?: string;
  error?: boolean;
  helperText?: string;
  /** Affiche un bouton « Vider la saisie » accessible (défaut : false). */
  clearable?: boolean;
  disabled?: boolean;
  /** Ajoute `aria-required` sur le champ (défaut : false). */
  required?: boolean;
  /** Sentinelle « Tout (dé)sélectionner » (défaut : true). */
  selectAll?: boolean;
  /** [Espace] coche l'option survolée au clavier (défaut : true). RGAA. */
  spaceToggle?: boolean;
  /** Rend les chips des éléments sélectionnés sous le champ (défaut : true). */
  renderChips?: boolean;
  /** Libellé du conteneur des chips (défaut : `${label} sélection`). */
  chipsContainerAriaLabel?: string;
  /** Props additionnelles sur le bouton d'un chip (aria-describedby, disabled…). */
  getChipButtonProps?: (id: string) => Record<string, unknown>;
  /** Replace le focus sur le champ après suppression d'un chip (défaut : true). RGAA. */
  refocusFieldOnRemove?: boolean;
}

export function MultiSelectAutocomplete<T extends OptionWithId>({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  getOptionLabel,
  renderOptionContent,
  noOptionsText = "Aucun résultat",
  error,
  helperText,
  clearable = false,
  disabled = false,
  required = false,
  selectAll = true,
  spaceToggle = true,
  renderChips = true,
  chipsContainerAriaLabel,
  getChipButtonProps,
  refocusFieldOnRemove = true,
}: MultiSelectAutocompleteProps<T>) {
  // Saisie contrôlée : par défaut MUI vide le champ à chaque sélection
  // (`reason: "reset"`), ce qui oblige à retaper la recherche entre deux coches.
  const [inputValue, setInputValue] = useState("");

  const selectedOptions = options.filter((o) => value.includes(o.id));
  const allSelected = options.length > 0 && value.length === options.length;

  const selectAllOption = { id: SELECT_ALL_ID } as T;
  // Sentinelle ajoutée seulement s'il y a des options réelles, sinon MUI
  // n'afficherait plus le `noOptionsText`.
  const optionsWithSelectAll =
    selectAll && options.length > 0 ? [selectAllOption, ...options] : options;
  const selectAllLabel = allSelected
    ? "Tout désélectionner"
    : "Tout sélectionner";

  // Libellé d'une option, sentinelle « Tout (dé)sélectionner » incluse. Partagé
  // entre l'affichage (getOptionLabel) et le filtrage (filterOptions).
  function optionLabel(option: T) {
    return option.id === SELECT_ALL_ID
      ? selectAllLabel
      : getOptionLabel(option);
  }

  // Bascule une option (ou « tout ») — partagée entre clic souris, Entrée et
  // [Espace] pour garantir un comportement identique.
  function toggleOption(option: T) {
    if (option.id === SELECT_ALL_ID) {
      onChange(allSelected ? [] : options.map((o) => o.id));
      return;
    }
    onChange(
      value.includes(option.id)
        ? value.filter((existingId) => existingId !== option.id)
        : [...value, option.id],
    );
  }

  const space = useAutocompleteSpaceToggle<T>(toggleOption);

  function handleRemoveChip(removedId: string) {
    onChange(value.filter((existingId) => existingId !== removedId));
    if (refocusFieldOnRemove) {
      // Le champ porte l'id passé en prop (MUI le pose sur l'input).
      requestAnimationFrame(() => document.getElementById(id)?.focus());
    }
  }

  return (
    <>
      {label && (
        <label className="fr-label mb-1" htmlFor={id}>
          {label}
        </label>
      )}
      <Autocomplete
        id={id}
        multiple
        disableCloseOnSelect
        disabled={disabled}
        disableClearable={!clearable}
        clearText="Vider la saisie"
        inputValue={inputValue}
        onInputChange={(_event, newInputValue, reason) => {
          // "reset" est émis après chaque sélection : on ignore pour garder la
          // recherche en cours.
          if (reason !== "reset") {
            setInputValue(newInputValue);
          }
        }}
        onClose={() => setInputValue("")}
        onHighlightChange={spaceToggle ? space.onHighlightChange : undefined}
        slotProps={{
          popper: { placement: "bottom-start" },
          paper: { sx: autocompleteOptionFocusSx },
          popupIndicator: popupIndicatorA11yProps,
          ...(clearable ? { clearIndicator: clearIndicatorA11yProps } : {}),
        }}
        options={optionsWithSelectAll}
        filterOptions={createSpaceInsensitiveFilter(optionLabel)}
        getOptionLabel={optionLabel}
        value={selectedOptions}
        isOptionEqualToValue={(option, v) => option.id === v.id}
        onChange={(_event, newValue) => {
          // Entrée/clic sur la sentinelle → tout (dé)sélectionner
          if (newValue.some((o) => o.id === SELECT_ALL_ID)) {
            onChange(allSelected ? [] : options.map((o) => o.id));
            return;
          }
          onChange(newValue.map((o) => o.id));
        }}
        renderTags={() => null}
        renderOption={(props, option, { selected }) => {
          const { key, ...optionProps } = props;
          const isSelectAll = option.id === SELECT_ALL_ID;
          return (
            <li
              key={key}
              {...optionProps}
              style={isSelectAll ? { fontWeight: 600 } : undefined}
            >
              <Checkbox
                checked={isSelectAll ? allSelected : selected}
                sx={{ mr: 1 }}
              />
              {isSelectAll
                ? selectAllLabel
                : renderOptionContent
                  ? renderOptionContent(option)
                  : getOptionLabel(option)}
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder}
            variant="filled"
            hiddenLabel
            error={error}
            helperText={helperText}
            sx={autocompleteFilledTextFieldSx}
            inputProps={{
              ...params.inputProps,
              "aria-haspopup": "listbox",
              ...(required ? { "aria-required": true } : {}),
              onKeyDown: (
                event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
              ) => {
                if (spaceToggle) {
                  space.onKeyDown(
                    event,
                    (event.target as HTMLInputElement).value,
                  );
                }
                params.inputProps.onKeyDown?.(
                  event as KeyboardEvent<HTMLInputElement>,
                );
              },
            }}
          />
        )}
        noOptionsText={noOptionsText}
      />
      {renderChips && value.length > 0 && (
        <ul
          className="flex flex-wrap gap-2 list-none p-0 m-0 mt-2"
          aria-label={
            chipsContainerAriaLabel ?? `${label ?? "Éléments"} sélection`
          }
        >
          {value.map((selectedId) => {
            const option = options.find((o) => o.id === selectedId);
            const optionLabel = option ? getOptionLabel(option) : selectedId;
            const extraButtonProps = getChipButtonProps?.(selectedId) ?? {};
            return (
              <li key={selectedId}>
                <Tag
                  dismissible
                  nativeButtonProps={{
                    type: "button",
                    "aria-label": `Retirer ${optionLabel}`,
                    ...extraButtonProps,
                    onClick: () => handleRemoveChip(selectedId),
                  }}
                >
                  {optionLabel}
                </Tag>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
