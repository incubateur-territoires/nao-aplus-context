import { useState, useEffect, useRef } from "react";

/**
 * Maintient un état actif (typiquement un chargement) pendant une durée
 * minimale, pour que les indicateurs de chargement restent perceptibles même
 * quand la donnée arrive en quelques dizaines de millisecondes.
 *
 * Retourne `true` tant que `isActive` est vrai, puis jusqu'à ce que
 * `minimumMs` se soient écoulés depuis le passage à l'état actif.
 */
export function useMinimumDuration(
  isActive: boolean,
  minimumMs: number,
): boolean {
  const [isHeld, setIsHeld] = useState(isActive);
  const activatedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      activatedAtRef.current = Date.now();
      setIsHeld(true);
      return;
    }

    if (activatedAtRef.current === null) {
      setIsHeld(false);
      return;
    }

    const remaining = minimumMs - (Date.now() - activatedAtRef.current);

    if (remaining <= 0) {
      setIsHeld(false);
      return;
    }

    const handler = setTimeout(() => setIsHeld(false), remaining);

    return () => {
      clearTimeout(handler);
    };
  }, [isActive, minimumMs]);

  return isActive || isHeld;
}
