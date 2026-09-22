"use client";

import { useMemo, useRef, useState } from "react";
import { SegmentedControl } from "@codegouvfr/react-dsfr/SegmentedControl";
import { type ColumnDef } from "@tanstack/react-table";
import { ActionMenu } from "@/app/component/action-menu/action-menu";
import { DataTable } from "@/app/component/data-table/data-table";
import { formatPercentage, sumValues } from "@/utils/stats-percentage";
import type { StatsColumnHeaders } from "@/types/stats";
import { StatsChart, type StatsChartType } from "../stats-chart/stats-chart";
import { StatLegend } from "../stat-legend/stat-legend";
import { StatEmptyState } from "../stat-empty-state/stat-empty-state";

const EXPORT_ACTIONS = [
  { value: "screenshot", label: "Capture d'écran" },
  { value: "xlsx", label: "Télécharger en *.xlsx" },
];

interface StatCardProps {
  /** Identifiant stable (utilisé pour les groupes de boutons radio). */
  id: string;
  title: string;
  /** Précise ce que mesure le graphique, sous le titre. */
  description?: string;
  /** `share` : un chiffre vedette (part de `values[0]` dans le total). */
  chartType: StatsChartType | "share";
  labels: string[];
  values: number[];
  seriesName?: string;
  unit?: string;
  /**
   * Nomme les colonnes de la série (« Date » / « Nombre de signalements ») dans
   * la vue tableau comme dans l'export : « Libellé » et « Valeur » ne disent
   * rien une fois le fichier ouvert, détaché de son graphique.
   */
  columnHeaders: StatsColumnHeaders;
  /** Nom de fichier (sans extension) pour les exports (xlsx / capture). */
  exportFileName: string;
  /** Ouvre le tiroir de filtres (lien de l'état vide). */
  onOpenFilters?: () => void;
}

interface StatRow {
  label: string;
  value: number;
}

const numberFormatter = new Intl.NumberFormat("fr-FR");

export function StatCard({
  id,
  title,
  description,
  chartType,
  labels,
  values,
  seriesName,
  unit,
  columnHeaders,
  exportFileName,
  onOpenFilters,
}: StatCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const cardRef = useRef<HTMLDivElement>(null);

  // Les diagrammes circulaires (donut) et le chiffre vedette sont évalués en
  // pourcentage : on affiche la part de chaque valeur dans la légende et dans
  // une colonne dédiée du tableau. Sans objet pour les graphiques en barres.
  const showPercentage = chartType === "pie" || chartType === "share";
  const total = useMemo(() => sumValues(values), [values]);

  const rows = useMemo<StatRow[]>(
    () => labels.map((label, index) => ({ label, value: values[index] ?? 0 })),
    [labels, values],
  );

  // Légende maison (sous le graphique) : « Libellé (45,6 %) » pour les donuts —
  // le pourcentage borde chaque portion. Les graphiques en barres (mono-série)
  // affichent le nom de la série. Le graphique, lui, reçoit les libellés bruts :
  // sa légende intégrée est masquée (CSS `.stats-chart`).
  const legendLabels = useMemo(
    () =>
      showPercentage
        ? labels.map(
            (label, index) =>
              `${label} (${formatPercentage(values[index] ?? 0, total)})`,
          )
        : [seriesName ?? title],
    [showPercentage, labels, values, total, seriesName, title],
  );

  const columns = useMemo<ColumnDef<StatRow>[]>(() => {
    const baseColumns: ColumnDef<StatRow>[] = [
      {
        accessorKey: "label",
        header: columnHeaders.label,
        meta: { sortType: "alpha" },
      },
      {
        accessorKey: "value",
        header: columnHeaders.value,
        meta: { sortType: "numeric", cellClassName: "text-right" },
      },
    ];
    if (!showPercentage) return baseColumns;

    return [
      ...baseColumns,
      {
        id: "percentage",
        // Trié sur la valeur brute (proportionnelle à la part) ; la
        // cellule affiche le pourcentage formaté.
        accessorFn: (row) => row.value,
        header: "Part",
        cell: ({ row }) => formatPercentage(row.original.value, total),
        meta: { sortType: "numeric", cellClassName: "text-right" },
      },
    ];
  }, [showPercentage, total, columnHeaders]);

  const hasData = values.some((value) => value > 0);

  // SheetJS (~400 Ko) et html-to-image ne servent qu'au clic sur « Exporter » :
  // importés statiquement, ils pèseraient sur le chargement initial de la page,
  // qui monte sept cartes. On les charge donc à la demande.
  async function handleExport(value: string) {
    if (value === "xlsx") {
      const { exportStatsXlsx } = await import("@/utils/export-stats-xlsx");
      exportStatsXlsx(
        exportFileName,
        labels,
        values,
        columnHeaders,
        showPercentage,
      );
    } else if (value === "screenshot") {
      const { captureStatChart } = await import("@/utils/capture-stat-chart");
      captureStatChart(cardRef.current, exportFileName);
    }
  }

  return (
    <section ref={cardRef} className="flex flex-col gap-8 bg-white p-6 md:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="fr-h4 mb-0">{title}</h2>
        {description && (
          <p className="fr-text--sm mb-0 text-(--text-mention-grey)">
            {description}
          </p>
        )}
      </div>

      {!hasData ? (
        <StatEmptyState contextLabel={title} onOpenFilters={onOpenFilters} />
      ) : (
        <>
          {view === "table" ? (
            <DataTable
              columns={columns}
              data={rows}
              emptyMessage="Aucune donnée"
            />
          ) : chartType === "share" ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
              <p className="mb-0 text-6xl leading-none font-semibold text-(--text-title-grey)">
                {formatPercentage(values[0] ?? 0, total)}
              </p>
              <p className="fr-text--lg mb-0">
                {labels[0]} : {numberFormatter.format(values[0] ?? 0)} sur{" "}
                {numberFormatter.format(total)}
                {unit ? ` ${unit}` : ""}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="min-h-[300px] min-w-0">
                <StatsChart
                  type={chartType}
                  labels={labels}
                  values={values}
                  seriesName={seriesName}
                  unit={unit}
                  withPercentage={showPercentage}
                />
              </div>
              <StatLegend labels={legendLabels} />
            </div>
          )}

          <div
            className="flex flex-wrap items-center justify-between gap-4"
            data-capture-exclude
          >
            <SegmentedControl
              hideLegend
              legend={`Affichage de « ${title} »`}
              small
              segments={[
                {
                  label: "Graphique",
                  iconId: "fr-icon-bar-chart-box-line",
                  nativeInputProps: {
                    name: `view-${id}`,
                    checked: view === "chart",
                    onChange: () => setView("chart"),
                  },
                },
                {
                  label: "Tableau",
                  iconId: "fr-icon-table-line",
                  nativeInputProps: {
                    name: `view-${id}`,
                    checked: view === "table",
                    onChange: () => setView("table"),
                  },
                },
              ]}
            />
            <ActionMenu
              ariaLabel={`Exporter les données de « ${title} »`}
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
