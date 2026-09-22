import { useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { AutocompleteHighlightChangeReason } from "@mui/material/useAutocomplete";

/**
 * RGAA : permet de cocher/décocher l'option survolée au clavier avec [Espace],
 * comme une vraie case à cocher. Par défaut, un `Autocomplete` MUI insère
 * l'espace dans le champ de saisie au lieu d'activer l'option survolée.
 *
 * Le hook mémorise l'option survolée (via `onHighlightChange`) et renvoie un
 * `onKeyDown` à composer avec celui de MUI : si [Espace] est pressé alors que le
 * champ est vide et qu'une option est survolée, on active l'option et on empêche
 * l'insertion de l'espace.
 *
 * On n'intercepte [Espace] que pour cocher/décocher l'option survolée au clavier
 * (case à cocher). Dans tous les autres cas, l'espace reste un caractère normal
 * et s'insère dans le champ (pattern ARIA) : c'est le filtre qui ignore les
 * espaces (RGAA : « les espaces du champ ne sont pas pris en compte »), pas la
 * frappe.
 *
 * Garde « champ vide » : on n'agit que si le champ ne contient pas de texte de
 * filtrage, pour préserver la frappe d'une espace lors d'une recherche
 * multi-mots (ex. « France Services »).
 *
 * Garde « survol clavier uniquement » : on ne mémorise dans `highlightedRef` que
 * les survols issus de la navigation clavier (`reason === "keyboard"`). Un survol
 * « auto » (réouverture/filtrage) ou souris est ignoré.
 *
 * Garde « option réellement surlignée » : au keydown on vérifie
 * `aria-activedescendant` sur le combobox. Il ne pointe sur une option que
 * pendant la navigation clavier ; `highlightedRef` pouvant rester sur une option
 * fantôme (clic ailleurs, fermeture…), c'est ce drapeau live qui fait foi.
 * Sans surlignage actif, l'espace reste un caractère normal et s'insère.
 *
 * @param onToggle Action à exécuter sur l'option survolée (réutilise la logique
 *   de sélection existante, sentinelle « Tout sélectionner » incluse).
 */
export function useAutocompleteSpaceToggle<T>(onToggle: (option: T) => void) {
  const highlightedRef = useRef<T | null>(null);

  const onHighlightChange = useCallback(
    (
      _event: React.SyntheticEvent,
      option: T | null,
      reason: AutocompleteHighlightChangeReason,
    ) => {
      highlightedRef.current = reason === "keyboard" ? option : null;
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, inputValue: string) => {
      if (event.key !== " " || inputValue.trim() !== "") return;
      // Une option n'est réellement surlignée que si aria-activedescendant pointe
      // dessus (navigation clavier en cours). Dans ce cas seulement, [Espace]
      // coche/décoche comme une case à cocher et n'est pas inséré.
      const hasActiveOption = !!event.currentTarget.getAttribute(
        "aria-activedescendant",
      );
      if (hasActiveOption && highlightedRef.current) {
        event.preventDefault();
        onToggle(highlightedRef.current);
      }
      // Sinon : l'espace s'insère normalement. Le filtre l'ignore, donc aucune
      // option ne disparaît.
    },
    [onToggle],
  );

  return { onHighlightChange, onKeyDown };
}
