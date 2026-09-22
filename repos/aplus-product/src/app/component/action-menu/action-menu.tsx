"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface ActionMenuAction {
  value: string;
  label: string;
}

export interface ActionMenuHandle {
  focusTrigger: () => void;
}

interface ActionMenuProps {
  ariaLabel: string;
  actions: ActionMenuAction[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  buttonLabel?: string;
  /**
   * Icône DSFR affichée à gauche du label. Par défaut l'engrenage
   * (`fr-icon-settings-5-line`). Passer `null` pour n'afficher aucune icône.
   */
  iconId?: string | null;
}

/**
 * Menu d'actions accessible (RGAA) : un bouton qui ouvre une liste d'actions.
 *
 * - Navigation clavier : flèches (avec bouclage), Home/End, Échap pour refermer
 *   en rendant le focus au bouton.
 * - Le focus n'est pas enfermé : Tab sort naturellement et referme le menu.
 * - Menu positionné en `fixed` pour ne pas être rogné par l'overflow du tableau ;
 *   il se ferme au scroll/redimensionnement.
 *
 * Exposé via ref : `focusTrigger()` pour rendre le focus au bouton (ex. après la
 * fermeture d'une modale déclenchée par une action).
 */
export const ActionMenu = forwardRef<ActionMenuHandle, ActionMenuProps>(
  function ActionMenu(
    {
      ariaLabel,
      actions,
      onSelect,
      disabled,
      buttonLabel = "Action",
      iconId = "fr-icon-settings-5-line",
    },
    ref,
  ) {
    const [isOpen, setIsOpen] = useState(false);
    // Position en `fixed` du menu : évite que l'overflow du conteneur du tableau
    // (DataTable utilise overflow-x-auto) ne rogne le menu sur les dernières lignes.
    const [menuPosition, setMenuPosition] = useState<{
      top: number;
      right: number;
    } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useImperativeHandle(ref, () => ({
      focusTrigger: () => buttonRef.current?.focus(),
    }));

    // À l'ouverture, on déplace le focus sur le premier élément du menu pour
    // permettre la navigation au clavier (flèches) sans enfermer le focus.
    // preventScroll : ne pas déclencher de scroll (qui refermerait le menu).
    useEffect(() => {
      if (isOpen) {
        itemRefs.current[0]?.focus({ preventScroll: true });
      }
    }, [isOpen]);

    // Le menu est positionné en `fixed` : il ne suit pas le défilement. On le
    // ferme donc au scroll (capture, pour intercepter le scroll du tableau) ou
    // au redimensionnement, afin qu'il ne reste pas « flottant » au mauvais endroit.
    useEffect(() => {
      if (!isOpen) {
        return;
      }
      function close() {
        setIsOpen(false);
      }
      window.addEventListener("scroll", close, true);
      window.addEventListener("resize", close);
      return () => {
        window.removeEventListener("scroll", close, true);
        window.removeEventListener("resize", close);
      };
    }, [isOpen]);

    // Calcule la position du menu (aligné sous le bouton, bord droit commun) puis l'ouvre.
    function openMenu() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuPosition({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      }
      setIsOpen(true);
    }

    function toggleMenu() {
      if (isOpen) {
        setIsOpen(false);
      } else {
        openMenu();
      }
    }

    function handleSelect(value: string) {
      setIsOpen(false);
      onSelect(value);
    }

    // Ferme le menu lorsque le focus quitte son conteneur (le focus n'est pas
    // enfermé : Tab sort naturellement et referme le menu).
    function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setIsOpen(false);
      }
    }

    // Navigation clavier dans le menu ouvert : flèches (avec bouclage),
    // Home/End, et Échap pour refermer en rendant le focus au bouton.
    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      if (event.key === "Escape") {
        if (isOpen) {
          setIsOpen(false);
          buttonRef.current?.focus();
        }
        return;
      }

      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        return;
      }
      event.preventDefault();

      // Ignore les keydown répétés (touche maintenue) : ouvrir le menu avec ↓
      // ne doit pas faire défiler immédiatement vers l'option suivante.
      if (event.repeat) {
        return;
      }

      // Ouvre le menu si fermé ; l'effet placera le focus sur le 1er élément.
      if (!isOpen) {
        openMenu();
        return;
      }

      const items = itemRefs.current.filter(
        (el): el is HTMLButtonElement => el !== null,
      );
      if (items.length === 0) {
        return;
      }
      const currentIndex = items.indexOf(
        document.activeElement as HTMLButtonElement,
      );

      let nextIndex = currentIndex;
      if (event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % items.length;
      } else if (event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + items.length) % items.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = items.length - 1;
      }

      items[nextIndex]?.focus();
    }

    return (
      <div className="relative" onBlur={handleBlur} onKeyDown={handleKeyDown}>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          disabled={disabled}
          // Safari/Firefox (macOS) ne donnent pas le focus à un <button> au clic.
          // Sans cela, cliquer le bouton ferait perdre le focus à l'élément actif
          // du menu (relatedTarget null → handleBlur ferme le menu). On bloque le
          // transfert de focus au mousedown ; le click (donc le toggle) passe quand même.
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleMenu}
          className="fr-btn fr-btn--secondary fr-btn--sm w-fit whitespace-nowrap"
          // Bordure grise neutre (token de thème DSFR, clair/sombre).
          style={{
            boxShadow: "inset 0 0 0 1px var(--border-default-grey)",
          }}
        >
          {iconId && (
            <span className={`${iconId} fr-icon--sm mr-1`} aria-hidden="true" />
          )}
          {buttonLabel}
          <span
            className={`fr-icon-arrow-down-s-line fr-icon--sm ml-1 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
        {isOpen && (
          <ul
            style={{
              position: "fixed",
              top: menuPosition?.top,
              right: menuPosition?.right,
            }}
            className="z-[1000] m-0 list-none p-0 bg-white shadow-md border border-[#dddddd] min-w-[200px]"
          >
            {actions.map((action, index) => (
              <li key={action.value}>
                <button
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  // Voir le commentaire du bouton déclencheur : on empêche le
                  // blur parasite de Safari/Firefox qui fermerait le menu avant
                  // que le click ne déclenche handleSelect.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(action.value)}
                  className="w-full text-left px-4 py-2 text-sm bg-transparent border-none cursor-pointer hover:bg-[#f6f6f6] focus:bg-[#eeeeee] focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-[#0a76f6]"
                >
                  {action.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
