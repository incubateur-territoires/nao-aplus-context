"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { ActionMenu } from "@/app/component/action-menu/action-menu";
import { DataTable } from "@/app/component/data-table/data-table";
import { formatPercentage } from "@/utils/stats-percentage";
import type { CareDelayTeamRow } from "@/trpc/routers/stats";
import { StatEmptyState } from "../stat-empty-state/stat-empty-state";

const TITLE = "Délais de prise en charge";
const EXPORT_FILE_NAME = "delais-de-prise-en-charge";

// Pas de capture d'écran ici (contrairement aux cartes du masonry) : le tableau
// fait 1800px de large et défile horizontalement, une capture ne prendrait que
// les colonnes visibles. L'export XLSX fournit déjà toutes les données.
const EXPORT_ACTIONS = [{ value: "xlsx", label: "Télécharger en *.xlsx" }];

const delayFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

/** Délai moyen : « 1,2 » ou « — » quand aucun signalement n'a été pris en charge. */
function formatDelay(days: number | null): string {
  return days === null ? "—" : delayFormatter.format(days);
}

/** Taux de prise en charge sous N jours ouvrés, rapporté aux signalements pris en charge. */
function formatRate(count: number, inTreatmentCount: number): string {
  return inTreatmentCount === 0
    ? "—"
    : formatPercentage(count, inTreatmentCount);
}

/**
 * Cellule « nombre au-dessus, taux en dessous » des colonnes « en moins de N
 * jours ouvrés » (cf. maquette Figma : les deux valeurs, pas l'une ou l'autre).
 */
function renderCountAndRate(count: number, inTreatmentCount: number) {
  return (
    <span className="flex flex-col items-end">
      <span>{count}</span>
      <span className="text-mention-grey text-sm">
        {formatRate(count, inTreatmentCount)}
      </span>
    </span>
  );
}

const COLUMNS: ColumnDef<CareDelayTeamRow>[] = [
  {
    accessorKey: "teamName",
    header: "Nom de l'équipe",
    meta: { sortType: "alpha" },
  },
  {
    accessorKey: "totalReports",
    header: "Nombre de signalements",
    meta: { sortType: "numeric", cellClassName: "text-right" },
  },
  {
    accessorKey: "inTreatmentCount",
    header: "Nb. de sign. pris en charge",
    meta: { sortType: "numeric", cellClassName: "text-right" },
  },
  {
    id: "avgDelayBusinessDays",
    // Tri numérique sur la valeur brute ; les équipes sans prise en charge
    // sont reléguées en fin de tri (tanstack ne gère que `undefined`, pas `null`).
    accessorFn: (row) => row.avgDelayBusinessDays ?? undefined,
    sortUndefined: "last",
    header: () => (
      <span>
        Délai de prise en charge moyen
        <br />
        <span className="font-normal">(en jours ouvrés)</span>
      </span>
    ),
    cell: ({ row }) => formatDelay(row.original.avgDelayBusinessDays),
    meta: { sortType: "numeric", cellClassName: "text-right" },
  },
  {
    accessorKey: "underOneBusinessDayCount",
    header: () => (
      <span>
        Nb de sign. pris en charge
        <br />
        en moins d&apos;1 jour ouvré
      </span>
    ),
    meta: { sortType: "numeric", cellClassName: "text-right" },
  },
  {
    id: "underTwoBusinessDaysRate",
    // Trié sur le taux (proportion), la cellule affiche le pourcentage formaté.
    accessorFn: (row) =>
      row.inTreatmentCount === 0
        ? -1
        : row.underTwoBusinessDaysCount / row.inTreatmentCount,
    header: () => (
      <span>
        En moins de 2 jours ouvrés
        <br />
        <span className="font-normal">Taux</span>
      </span>
    ),
    cell: ({ row }) =>
      renderCountAndRate(
        row.original.underTwoBusinessDaysCount,
        row.original.inTreatmentCount,
      ),
    meta: { sortType: "numeric", cellClassName: "text-right" },
  },
  {
    id: "underThreeBusinessDaysRate",
    accessorFn: (row) =>
      row.inTreatmentCount === 0
        ? -1
        : row.underThreeBusinessDaysCount / row.inTreatmentCount,
    header: () => (
      <span>
        En moins de 3 jours ouvrés
        <br />
        <span className="font-normal">Taux</span>
      </span>
    ),
    cell: ({ row }) =>
      renderCountAndRate(
        row.original.underThreeBusinessDaysCount,
        row.original.inTreatmentCount,
      ),
    meta: { sortType: "numeric", cellClassName: "text-right" },
  },
];

const XLSX_HEADER = [
  "Nom de l'équipe",
  "Nombre de signalements",
  "Nb. de sign. pris en charge",
  "Délai de prise en charge moyen (en jours ouvrés)",
  "Nb de sign. pris en charge en moins d'1 jour ouvré",
  "En moins de 2 jours ouvrés (nombre)",
  "En moins de 2 jours ouvrés (taux)",
  "En moins de 3 jours ouvrés (nombre)",
  "En moins de 3 jours ouvrés (taux)",
];

interface CareDelaysTableProps {
  rows: CareDelayTeamRow[];
  /** La requête a échoué : on le dit, au lieu d'afficher un tableau vide. */
  hasError?: boolean;
  /**
   * Données pas encore reçues. Sans cela, un tableau en cours de chargement se
   * lirait comme « aucun signalement ne correspond aux filtres ».
   */
  isLoading?: boolean;
  /** Ouvre le tiroir de filtres (lien de l'état vide). */
  onOpenFilters?: () => void;
}

/**
 * Bloc « Délais de prise en charge » : tableau par équipe opérateur sollicitée
 * (prise en charge = premier passage au statut « En cours de traitement »).
 * Tri et pagination côté client (une ligne par équipe).
 */
export function CareDelaysTable({
  rows,
  hasError,
  isLoading,
  onOpenFilters,
}: CareDelaysTableProps) {
  const hasData = rows.length > 0;

  // Lib d'export chargée à la demande : elle ne sert qu'au clic (cf. StatCard).
  async function handleExport(value: string) {
    if (value === "xlsx") {
      const { exportTableXlsx } = await import("@/utils/export-stats-xlsx");
      exportTableXlsx(
        EXPORT_FILE_NAME,
        XLSX_HEADER,
        rows.map((row) => [
          row.teamName,
          row.totalReports,
          row.inTreatmentCount,
          row.avgDelayBusinessDays ?? "",
          row.underOneBusinessDayCount,
          row.underTwoBusinessDaysCount,
          formatRate(row.underTwoBusinessDaysCount, row.inTreatmentCount),
          row.underThreeBusinessDaysCount,
          formatRate(row.underThreeBusinessDaysCount, row.inTreatmentCount),
        ]),
      );
    }
  }

  return (
    <section className="flex flex-col gap-10 bg-white p-6 md:p-20">
      <h2 className="fr-h4 mb-0">{TITLE}</h2>

      {hasError ? (
        <Alert
          severity="error"
          title="Ce tableau n'a pas pu être chargé"
          description="Une erreur est survenue. Réessayez plus tard ou modifiez vos filtres."
        />
      ) : isLoading ? (
        <p className="mb-0">Chargement du tableau…</p>
      ) : !hasData ? (
        <StatEmptyState contextLabel={TITLE} onOpenFilters={onOpenFilters} />
      ) : (
        <>
          {/* Largeur minimale pour préserver la lisibilité des 7 colonnes : le
              conteneur de DataTable (overflow-x-auto) prend le relais en
              défilement horizontal sur les écrans plus étroits. */}
          <div className="[&_table]:min-w-[1800px]">
            <DataTable
              columns={COLUMNS}
              data={rows}
              pageSize={10}
              defaultSorting={[{ id: "totalReports", desc: true }]}
              emptyMessage="Aucune donnée"
            />
          </div>

          <div className="flex justify-end">
            <ActionMenu
              ariaLabel={`Exporter les données de « ${TITLE} »`}
              buttonLabel="Exporter les données…"
              iconId={null}
              actions={EXPORT_ACTIONS}
              onSelect={handleExport}
            />
          </div>
        </>
      )}
    </section>
  );
}
