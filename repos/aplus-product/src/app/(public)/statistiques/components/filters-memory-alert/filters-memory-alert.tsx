"use client";

import { useState } from "react";
import { Alert } from "@codegouvfr/react-dsfr/Alert";

interface FiltersMemoryAlertProps {
  className?: string;
}

/**
 * Alerte d'information (fermable) expliquant que les filtres sont reflétés
 * dans l'URL : un marque-page du navigateur suffit à sauvegarder une page de
 * statistiques filtrée.
 */
export function FiltersMemoryAlert({ className }: FiltersMemoryAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <Alert
      severity="info"
      title="Mémoire des filtres"
      description={
        <>
          Les filtres sont conservés en mémoire. Si vous souhaitez sauvegarder
          votre page de statistiques filtrée, utilisez la fonction{" "}
          <em>Marque-page</em> de votre navigateur. Vous pouvez sauvegarder
          autant de pages filtrées que vous souhaitez.
        </>
      }
      closable
      onClose={() => setIsVisible(false)}
      className={className}
    />
  );
}
