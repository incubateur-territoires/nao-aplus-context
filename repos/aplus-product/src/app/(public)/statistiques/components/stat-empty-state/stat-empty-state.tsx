"use client";

import Image from "next/image";

interface StatEmptyStateProps {
  /**
   * Titre du bloc concerné. La page peut afficher plusieurs états vides
   * simultanément : sans ce contexte, tous les boutons porteraient le même nom
   * accessible et seraient indiscernables dans la liste des boutons (RGAA).
   */
  contextLabel?: string;
  /** Ouvre le tiroir de filtres (bouton « Modifier les filtres »). */
  onOpenFilters?: () => void;
}

/**
 * État vide d'un bloc de statistiques : aucun signalement ne correspond aux
 * filtres courants. Propose de rouvrir le tiroir pour les modifier.
 */
export function StatEmptyState({
  contextLabel,
  onOpenFilters,
}: StatEmptyStateProps) {
  return (
    // `role="status"` : le passage à l'état vide résulte d'un filtrage sans
    // rechargement, il doit être annoncé aux lecteurs d'écran.
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 py-10"
    >
      <Image
        src="/artwork/error-warning.svg"
        alt=""
        aria-hidden="true"
        width={240}
        height={240}
      />
      <p className="mb-0">
        Aucun signalement ne correspond à vos critères de filtrages.
      </p>
      {onOpenFilters && (
        <button
          type="button"
          className="fr-link fr-link--sm"
          aria-label={
            contextLabel ? `Modifier les filtres (${contextLabel})` : undefined
          }
          onClick={onOpenFilters}
        >
          Modifier les filtres
        </button>
      )}
    </div>
  );
}
