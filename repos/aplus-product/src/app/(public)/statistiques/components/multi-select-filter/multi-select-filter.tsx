"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import Tag from "@codegouvfr/react-dsfr/Tag";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { Spinner } from "@/app/component/spinner/spinner";
import { useAutocompleteSpaceToggle } from "@/app/hooks/use-autocomplete-space-toggle";
import {
  SELECT_ALL_ID,
  autocompleteFilledTextFieldSx,
  autocompleteOptionFocusSx,
  clearIndicatorA11yProps,
  createSpaceInsensitiveFilter,
} from "@/utils/autocomplete-a11y";

export interface MultiSelectOption {
  id: string;
  name: string;
}

interface MultiSelectFilterProps {
  label: string;
  /**
   * Classes appliquées au seul texte du label. Sert aux familles à champ unique,
   * dont le label tient lieu de titre de section (`fr-h6`) — sans quoi le même
   * intitulé apparaîtrait deux fois, en légende puis en label.
   */
  labelClassName?: string;
  /** Texte d'aide affiché sous le label (ex. « Par défaut, tout est sélectionné »). */
  hint?: string;
  placeholder: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /**
   * Recalcul des options en cours : affiche un indicateur à droite du champ.
   * Purement visuel (`aria-hidden`) — le recalcul est annoncé une seule fois
   * pour l'ensemble du formulaire, par `StatsFilters`.
   */
  isLoading?: boolean;
}

// Au-delà de ce nombre de sélections, on n'affiche que les premiers tags + un
// bouton « +X autres » (repliable), comme ailleurs dans l'app — évite que la
// liste de tags ne déborde.
const MAX_VISIBLE_TAGS = 3;

// --- Virtualisation de la liste (pattern officiel MUI v5) -------------------
// Les listes de filtres peuvent contenir des milliers d'options (ex. ~2500
// équipes). Sans virtualisation, MUI monte TOUTES les options (chacune avec un
// Checkbox) à l'ouverture → très lent. Ici on ne rend que les lignes visibles,
// tout en gardant un scroll continu sur l'intégralité de la liste.
const LISTBOX_PADDING = 8;
const ROW_HEIGHT = 44;
const MAX_VISIBLE_ROWS = 8;

// Donnée d'une ligne transmise via `renderOption` : props MUI, option, état
// coché, et drapeau « tout sélectionner ».
type OptionRowData = [
  HTMLAttributes<HTMLLIElement> & { key?: React.Key },
  MultiSelectOption,
  boolean,
  boolean,
];

function OptionRow({
  data,
  index,
  style,
}: ListChildComponentProps<OptionRowData[]>) {
  const [optionProps, option, checked, isSelectAll] = data[index];
  // En MUI v5, `renderOption` ne fournit pas de `key` (il vaut `undefined`) →
  // on retombe sur l'`id` de l'option, garanti unique.
  const { key, ...liProps } = optionProps;
  return (
    <li
      {...liProps}
      key={key ?? option.id}
      style={{
        ...style,
        top: (style.top as number) + LISTBOX_PADDING,
        display: "flex",
        alignItems: "center",
      }}
    >
      <Checkbox checked={checked} sx={{ p: 0.5, mr: 1 }} disableRipple />
      {/* Hauteur de ligne fixe (virtualisation) → on tronque les libellés longs
          sur une seule ligne (ellipsis) pour éviter le chevauchement vertical.
          `minWidth: 0` est requis pour que l'ellipsis fonctionne dans un flex.
          `title` expose le nom complet au survol et aux lecteurs d'écran. */}
      <span
        title={option.name}
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: isSelectAll ? 600 : undefined,
        }}
      >
        {option.name}
      </span>
    </li>
  );
}

// Le conteneur scrollable de react-window doit recevoir les props que MUI pose
// normalement sur la <ul> (role="listbox", id, gestionnaires…).
const OuterElementContext = createContext<HTMLAttributes<HTMLDivElement>>({});
const OuterElement = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function OuterElement(props, ref) {
    const outerProps = useContext(OuterElementContext);
    return <div ref={ref} {...props} {...outerProps} />;
  },
);

const VirtualizedListbox = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLElement>
>(function VirtualizedListbox(props, ref) {
  const { children, ...other } = props;
  const items = (children as OptionRowData[] | undefined) ?? [];
  const itemCount = items.length;
  const height =
    Math.min(itemCount, MAX_VISIBLE_ROWS) * ROW_HEIGHT + 2 * LISTBOX_PADDING;

  return (
    <div ref={ref}>
      <OuterElementContext.Provider value={other}>
        <FixedSizeList
          height={height}
          width="100%"
          itemCount={itemCount}
          itemSize={ROW_HEIGHT}
          itemData={items}
          outerElementType={OuterElement}
          innerElementType="ul"
          overscanCount={5}
        >
          {OptionRow}
        </FixedSizeList>
      </OuterElementContext.Provider>
    </div>
  );
});

export function MultiSelectFilter({
  label,
  labelClassName,
  hint,
  placeholder,
  options,
  selectedIds,
  onChange,
  isLoading,
}: MultiSelectFilterProps) {
  const [tagsExpanded, setTagsExpanded] = useState(false);
  // Saisie contrôlée : par défaut MUI vide le champ à chaque sélection
  // (`reason: "reset"`), ce qui oblige à retaper la recherche entre deux coches.
  const [inputValue, setInputValue] = useState("");

  const optionById = useMemo(
    () => new Map(options.map((option) => [option.id, option])),
    [options],
  );

  // Set pour un lookup O(1) : sans lui, le filtre ci-dessous est O(n²)
  // (`includes` dans un `filter`) → ~6 M d'opérations à chaque rendu quand on
  // sélectionne « tout » sur une liste de ~2500 équipes, ce qui fige l'UI.
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedIdSet.has(option.id)),
    [options, selectedIdSet],
  );
  const allSelected =
    options.length > 0 && selectedIds.length === options.length;

  const selectAllOption: MultiSelectOption = {
    id: SELECT_ALL_ID,
    name: allSelected ? "Tout désélectionner" : "Tout sélectionner",
  };
  const optionsWithSelectAll =
    options.length > 0 ? [selectAllOption, ...options] : options;

  // Bascule l'option survolée — partagée entre clic et [Espace] (RGAA).
  function toggleOption(option: MultiSelectOption) {
    if (option.id === SELECT_ALL_ID) {
      onChange(allSelected ? [] : options.map((o) => o.id));
      return;
    }
    onChange(
      selectedIdSet.has(option.id)
        ? selectedIds.filter((id) => id !== option.id)
        : [...selectedIds, option.id],
    );
  }

  const space = useAutocompleteSpaceToggle<MultiSelectOption>(toggleOption);

  return (
    <div className="flex flex-col gap-2">
      <label className="fr-label">
        {/* Le texte du label est isolé dans un span : porter `labelClassName`
            sur le `.fr-label` lui-même ferait s'affronter deux classes de même
            spécificité (`.fr-label` vs `.fr-h6`), départagées par l'ordre de la
            feuille DSFR. Sur l'enfant, la règle s'applique sans ambiguïté et le
            texte d'aide garde sa propre taille. */}
        <span className={labelClassName}>{label}</span>
        {hint && <span className="fr-hint-text">{hint}</span>}
      </label>
      {/* Le champ et son indicateur de recalcul partagent une ligne : la boîte
          du spinner garde sa taille en permanence pour que le champ ne se
          rétrécisse pas à chaque apparition. */}
      <div className="flex items-center gap-2">
        <Autocomplete
          fullWidth
          multiple
          disableCloseOnSelect
          disableListWrap
          inputValue={inputValue}
          onInputChange={(_event, newInputValue, reason) => {
            // "reset" est émis après chaque sélection : on ignore pour garder
            // la recherche en cours.
            if (reason !== "reset") {
              setInputValue(newInputValue);
            }
          }}
          onClose={() => setInputValue("")}
          onHighlightChange={space.onHighlightChange}
          slotProps={{
            popper: { placement: "bottom-start" },
            paper: { sx: autocompleteOptionFocusSx },
            clearIndicator: clearIndicatorA11yProps,
          }}
          options={optionsWithSelectAll}
          filterOptions={createSpaceInsensitiveFilter((option) => option.name)}
          getOptionLabel={(option) => option.name}
          value={selectedOptions}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_event, newValue) => {
            if (newValue.some((option) => option.id === SELECT_ALL_ID)) {
              onChange(allSelected ? [] : options.map((option) => option.id));
              return;
            }
            onChange(newValue.map((option) => option.id));
          }}
          renderTags={() => null}
          ListboxComponent={VirtualizedListbox}
          renderOption={(optionProps, option, { selected }) => {
            const isSelectAll = option.id === SELECT_ALL_ID;
            const checked = isSelectAll ? allSelected : selected;
            // En mode virtualisé, `renderOption` ne renvoie pas du JSX mais la
            // donnée de ligne consommée par `VirtualizedListbox`.
            return [optionProps, option, checked, isSelectAll] as ReactNode;
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={placeholder}
              variant="filled"
              hiddenLabel
              sx={autocompleteFilledTextFieldSx}
              inputProps={{
                ...params.inputProps,
                onKeyDown: (
                  event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
                ) => {
                  space.onKeyDown(
                    event,
                    (event.target as HTMLInputElement).value,
                  );
                  params.inputProps.onKeyDown?.(
                    event as KeyboardEvent<HTMLInputElement>,
                  );
                },
              }}
            />
          )}
          noOptionsText="Aucun résultat"
        />
        {/* `aria-hidden` neutralise le `role="status"` interne du Spinner :
            cinq champs = cinq annonces. Le recalcul est annoncé une seule fois
            par `StatsFilters`. */}
        <div aria-hidden="true" className="size-5 shrink-0">
          {isLoading && <Spinner />}
        </div>
      </div>
      {selectedIds.length > 0 && (
        <ul
          className="m-0 flex list-none flex-wrap items-center gap-2 p-0"
          aria-label={`${label} — sélection`}
        >
          {(tagsExpanded
            ? selectedIds
            : selectedIds.slice(0, MAX_VISIBLE_TAGS)
          ).map((id) => {
            const name = optionById.get(id)?.name ?? id;
            return (
              <li key={id} className="min-w-0">
                <Tag
                  dismissible
                  className="max-w-full sm:max-w-[20rem]"
                  nativeButtonProps={{
                    type: "button",
                    title: name,
                    "aria-label": `Retirer ${name}`,
                    onClick: () =>
                      onChange(
                        selectedIds.filter((selected) => selected !== id),
                      ),
                  }}
                >
                  {/* Les noms d'équipe peuvent être très longs (« France Services
                      … - Centre socioculturel … - Ardèche ») : sans troncature, le
                      tag occupe toute la ligne et son libellé passe à la ligne.
                      `min-w-0` est requis pour que l'ellipsis opère dans le flex
                      du `.fr-tag` ; `title` expose le nom complet. */}
                  <span className="block min-w-0 truncate">{name}</span>
                </Tag>
              </li>
            );
          })}
          {selectedIds.length > MAX_VISIBLE_TAGS && (
            <li>
              <button
                type="button"
                className="text-blue-primary cursor-pointer text-sm underline"
                onClick={() => setTagsExpanded((expanded) => !expanded)}
              >
                {tagsExpanded
                  ? "Voir moins"
                  : `+${selectedIds.length - MAX_VISIBLE_TAGS} autres`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
