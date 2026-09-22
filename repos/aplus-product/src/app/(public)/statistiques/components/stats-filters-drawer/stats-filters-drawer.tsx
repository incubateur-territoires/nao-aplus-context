"use client";

import { useId, useRef } from "react";
import Drawer from "@mui/material/Drawer";
import Button from "@codegouvfr/react-dsfr/Button";
import type { StatsFilters as StatsFiltersValues } from "@/trpc/routers/stats";
import {
  StatsFilters,
  type StatsFilterOptions,
} from "../stats-filters/stats-filters";

interface StatsFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: StatsFiltersValues;
  options: StatsFilterOptions;
  onChange: (filters: StatsFiltersValues) => void;
  isLoadingOptions?: boolean;
  /**
   * Élément ayant ouvert le tiroir, capturé par le parent au moment du clic :
   * le focus lui est rendu à la fermeture (RGAA). Le capturer ici serait trop
   * tard — MUI s'est déjà attribué le focus quand le tiroir s'anime.
   */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Tiroir latéral gauche « Filtrer les statistiques » : contient le formulaire
 * de filtres (auto-appliqués) et le bouton de réinitialisation. MUI Drawer gère
 * le focus trap et la fermeture par Échap ; le focus initial (« Fermer le
 * panneau ») et sa restitution au déclencheur sont pris en charge ici.
 */
export function StatsFiltersDrawer({
  open,
  onClose,
  filters,
  options,
  onChange,
  isLoadingOptions,
  triggerRef,
}: StatsFiltersDrawerProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const hasActiveFilters = Object.values(filters).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      // À l'ouverture, MUI pose le focus sur le panneau lui-même (`autoFocus`
      // est ignoré : le contenu est monté dans un portail, hors document) et,
      // à la fermeture, il ne le rend pas au déclencheur. `onEntered`/`onExited`
      // encadrent les animations : ce sont les seuls points sûrs pour le faire.
      SlideProps={{
        onEntered: () => closeButtonRef.current?.focus(),
        onExited: () => triggerRef?.current?.focus(),
      }}
      aria-labelledby={titleId}
      sx={{
        "& .MuiDrawer-paper": {
          // Plein écran sur mobile, deux tiers de la largeur au-delà.
          width: { xs: "100vw", sm: "66.666vw" },
          maxWidth: "100vw",
        },
      }}
    >
      {/* La maquette pose 40px de marge sur un panneau de 880px ; le tiroir
          occupant deux tiers de l'écran, on élargit à mesure pour que le
          contenu ne colle pas aux bords. */}
      <div className="h-full overflow-y-auto">
        <div className="flex flex-col items-start gap-14 p-8 sm:p-12 lg:p-16">
          <div className="flex w-full flex-col gap-6">
            <div className="flex justify-end">
              <Button
                ref={closeButtonRef}
                type="button"
                priority="tertiary"
                size="small"
                iconId="fr-icon-close-line"
                iconPosition="right"
                onClick={onClose}
              >
                Fermer le panneau
              </Button>
            </div>
            <h2 id={titleId} className="mb-0">
              Filtrer les statistiques
            </h2>
            <p className="mb-0">
              <strong>
                Les filtres se mettent à jour automatiquement lors de leur
                activation, et ils sont liés les uns aux autres.
              </strong>{" "}
              <br />
              Par exemple, si vous choisissez le territoire de l&apos;Ain, vous
              n&apos;aurez pas accès aux équipes des autres territoires. Si
              votre recherche ne donne pas de résultat, supprimez des filtres.
            </p>
          </div>

          <StatsFilters
            filters={filters}
            options={options}
            onChange={onChange}
            isLoadingOptions={isLoadingOptions}
          />

          <hr className="w-full pb-px" />

          <Button
            type="button"
            priority="tertiary"
            size="small"
            iconId="fr-icon-delete-bin-line"
            iconPosition="right"
            disabled={!hasActiveFilters}
            onClick={() => onChange({})}
          >
            Réinitialiser tous les filtres
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
