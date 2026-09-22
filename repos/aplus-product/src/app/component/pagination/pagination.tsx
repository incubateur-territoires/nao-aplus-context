"use client";

import {
  Pagination as DsfrPagination,
  type PaginationProps,
} from "@codegouvfr/react-dsfr/Pagination";
import { useEffect, useRef } from "react";

const NAV_LINK_LABELS: Record<string, string> = {
  "fr-pagination__link--first": "Première page",
  "fr-pagination__link--prev": "Page précédente",
  "fr-pagination__link--next": "Page suivante",
  "fr-pagination__link--last": "Dernière page",
};

const NAV_LINK_SELECTOR = Object.keys(NAV_LINK_LABELS)
  .map((className) => `.${className}`)
  .join(", ");

/**
 * Wrapper autour de la pagination DSFR.
 *
 * DSFR applique `getPageLinkProps` à TOUS les liens, y compris les boutons de
 * navigation (« Première page », « Page précédente », « Page suivante »,
 * « Dernière page »). Ces boutons sont affichés en icône seule (le texte est
 * tronqué visuellement), et l'`aria-label` « Page N » injecté par
 * `getPageLinkProps` y écrase le nom fonctionnel du bouton.
 *
 * Comme `getPageLinkProps` reçoit le même numéro pour un bouton de navigation
 * et pour le bouton numéroté correspondant, on ne peut pas les distinguer dans
 * cette fonction. Après rendu, on remplace donc l'`aria-label` de chaque bouton
 * de navigation par son libellé fonctionnel ; les boutons numérotés conservent
 * le leur.
 *
 * On retire également le `role="link"` injecté par DSFR sur ces boutons de
 * navigation : il est redondant sur un `<a href>` (rôle `link` implicite) et
 * signalé par les audits d'accessibilité.
 */
export function Pagination(props: PaginationProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const navLinks = ref.current?.querySelectorAll(NAV_LINK_SELECTOR);
    navLinks?.forEach((link) => {
      link.removeAttribute("role");
      const className = Object.keys(NAV_LINK_LABELS).find((name) =>
        link.classList.contains(name),
      );
      if (className) {
        link.setAttribute("aria-label", NAV_LINK_LABELS[className]);
      }
    });
  });

  return <DsfrPagination ref={ref} {...props} />;
}
