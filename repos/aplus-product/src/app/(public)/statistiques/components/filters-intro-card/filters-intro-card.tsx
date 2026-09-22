"use client";

import Button from "@codegouvfr/react-dsfr/Button";

interface FiltersIntroCardProps {
  /** Ouvre le tiroir de filtres. */
  onOpen: () => void;
}

/**
 * Bloc d'introduction des filtres : explique la portée par défaut des
 * statistiques et porte le bouton ouvrant le tiroir, qui reste accessible
 * pendant tout le défilement de la page.
 *
 * Rendu en deux blocs frères plutôt qu'en une seule `<section>` : `position:
 * sticky` est borné par son bloc conteneur, donc un bouton enfermé dans la
 * section se décrocherait du haut de l'écran dès la fin du bloc
 * d'introduction. La barre doit être enfant direct du conteneur de page pour
 * couvrir toute la hauteur du défilement. Les deux blancs sont recollés par la
 * marge négative (qui annule le `gap` du parent) et se lisent comme une seule
 * carte.
 */
export function FiltersIntroCard({ onOpen }: FiltersIntroCardProps) {
  return (
    <>
      <section className="bg-white px-6 pt-6 pb-2 md:px-20 md:pt-20">
        <p className="mb-0">
          Les statistiques affichées par défaut concernent toutes les
          organisations côté aidant et côté opérateur, sur tous les territoires,
          depuis la date de mise en place des statistiques
          d&apos;Administration+ (octobre 2022).
          <br />
          Utilisez le bouton ci-dessous pour filtrer les statistiques selon vos
          besoins.
        </p>
      </section>

      {/* `z-[900]` : au-dessus des graphiques qui défilent dessous, mais sous
          le tiroir MUI (z-index 1200), qui la recouvre une fois ouvert. */}
      <div className="sticky top-0 z-[900] -mt-10 bg-white px-6 py-6 md:px-20">
        <Button
          type="button"
          size="large"
          iconId="fr-icon-filter-line"
          iconPosition="left"
          onClick={onOpen}
          nativeButtonProps={{
            "aria-haspopup": "dialog",
          }}
        >
          Filtrer les statistiques
        </Button>
      </div>
    </>
  );
}
