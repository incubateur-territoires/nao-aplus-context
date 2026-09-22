import { useEffect, useRef, RefObject } from "react";

interface UseFocusOnVisibleOptions {
  scroll?: boolean;
  block?: ScrollLogicalPosition;
}

/**
 * Déplace le focus (et scrolle) vers un conteneur quand il devient visible.
 * À utiliser pour les messages (Alert) qui apparaissent dynamiquement.
 *
 * Le conteneur ciblé DOIT porter `tabIndex={-1}` pour être focusable.
 * Le focus n'est rejoué que sur la transition `false -> true` de `isVisible` :
 * pour le rejouer à chaque succès, repasser `isVisible` à `false` avant
 * (pattern déjà en place : `setShowSuccessAlert(false)` en tête de `onSubmit`).
 */
export function useFocusOnVisible<T extends HTMLElement = HTMLDivElement>(
  isVisible: boolean,
  options: UseFocusOnVisibleOptions = {},
): RefObject<T | null> {
  const { scroll = true, block = "center" } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isVisible) return;
    const el = ref.current;
    if (!el) return;
    if (scroll) el.scrollIntoView({ behavior: "smooth", block });
    el.focus();
  }, [isVisible, scroll, block]);

  return ref;
}
