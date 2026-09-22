// Helpers partagés pour les comboboxes multi-sélection (MUI Autocomplete + DSFR).
// Centralise les correctifs d'accessibilité RGAA et les styles communs autrefois
// dupliqués dans ~8 implémentations (territoires, organisations, équipes…).

import { normalizeSearchQuery } from "./normalize";

/**
 * Option sentinelle « Tout (dé)sélectionner ». Rendue comme une vraie option MUI
 * (et non un <li> injecté hors du modèle d'options) → elle obtient un id,
 * participe à la navigation clavier (flèches + aria-activedescendant) et
 * s'active à Entrée/Espace. RGAA 7.1 : fonctionnalité utilisable au clavier.
 */
export const SELECT_ALL_ID = "__select_all__";

/**
 * Styles du `TextField` (variant filled) des comboboxes, alignés sur le DSFR.
 */
export const autocompleteFilledTextFieldSx = {
  "& .MuiFilledInput-root": {
    backgroundColor: "var(--background-contrast-grey)",
    borderRadius: "0.25rem 0.25rem 0 0",
    borderBottom: "2px solid var(--border-plain-grey)",
    paddingTop: "0",
    paddingBottom: "0",
    "&:hover": {
      backgroundColor: "var(--background-contrast-grey-hover)",
    },
    "&.Mui-focused": {
      backgroundColor: "var(--background-contrast-grey)",
      borderBottomColor: "var(--border-active-blue-france)",
    },
    "&::before, &::after": {
      display: "none",
    },
  },
  "& .MuiAutocomplete-input": {
    paddingTop: "10px !important",
    paddingBottom: "10px !important",
  },
  "& .MuiFilledInput-input": {
    "&::placeholder": {
      color: "#3A3A3A",
      opacity: 1,
    },
    fontSize: "1rem",
  },
} as const;

/**
 * RGAA : rend visible l'option survolée au clavier. MUI pose la classe
 * `Mui-focused` sur l'option via aria-activedescendant, mais sans marqueur
 * visuel suffisant. On ajoute un `outline` contrasté (DSFR bleu France, ≥ 3:1).
 * À injecter via `slotProps.paper.sx` (le slot `listbox` n'existe pas en MUI 5).
 */
export const autocompleteOptionFocusSx = {
  "& .MuiAutocomplete-option.Mui-focused": {
    outline: "2px solid var(--border-active-blue-france)",
    outlineOffset: "-2px",
  },
} as const;

/**
 * RGAA : rend le bouton « vider la saisie » utilisable au clavier et par les
 * technologies d'assistance. Par défaut MUI le pose en `tabindex="-1"` avec un
 * `title` peu explicite ; on le rend focusable, on retire le `title` (doublon
 * du nom accessible) et on donne un `aria-label` explicite en français.
 * À spreader dans `slotProps.clearIndicator` (appliqué après les props MUI).
 */
export const clearIndicatorA11yProps = {
  tabIndex: 0,
  title: undefined,
  "aria-label": "Vider la saisie",
} as const;

/**
 * RGAA : donne un nom accessible explicite en français au bouton d'ouverture de
 * la liste (le « popup indicator » de MUI). Par défaut MUI lui pose
 * `aria-label="Open"` ET `title="Open"` (nom accessible en anglais + infobulle
 * redondante). On retire le `title` (doublon du nom accessible) et on fournit un
 * `aria-label` français. À spreader dans `slotProps.popupIndicator` (appliqué
 * après les props MUI, donc prioritaire).
 */
export const popupIndicatorA11yProps = {
  title: undefined,
  "aria-label": "Afficher les options",
} as const;

/**
 * Filtre les options d'un `Autocomplete` MUI en ignorant totalement les espaces
 * de la saisie. Par défaut, MUI inclut les espaces dans la comparaison : taper
 * une simple espace (ou une espace superflue avant/après un mot) déplie le menu
 * et active le filtre, faisant disparaître les options à un seul mot. Ici on
 * retire toutes les espaces — et les accents/la casse via `normalizeSearchQuery`
 * — de la saisie comme du libellé avant comparaison : les espaces n'ont donc
 * aucun effet sur le filtrage.
 *
 * Conforme au pattern ARIA APG « combobox autocomplete-list ». À passer en
 * `filterOptions` de l'`Autocomplete`.
 *
 * @param getOptionLabel Renvoie le libellé d'une option (sentinelle « Tout
 *   (dé)sélectionner » incluse) — doit être le même que celui de l'`Autocomplete`.
 */
export function createSpaceInsensitiveFilter<T>(
  getOptionLabel: (option: T) => string,
) {
  return (options: T[], state: { inputValue: string }) => {
    const query = normalizeSearchQuery(state.inputValue).replace(/\s+/g, "");
    if (!query) return options;
    return options.filter((option) =>
      normalizeSearchQuery(getOptionLabel(option))
        .replace(/\s+/g, "")
        .includes(query),
    );
  };
}
