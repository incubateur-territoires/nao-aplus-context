"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import Tag from "@codegouvfr/react-dsfr/Tag";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { MultiSelectAutocomplete } from "@/app/component/multi-select-autocomplete/multi-select-autocomplete";
import { ROUTE } from "@/app/constant/route";
import { ReportStatus } from "@/generated/prisma/enums";
import * as XLSX from "xlsx";

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  [ReportStatus.PENDING_ASSIGNMENT]: "En attente de prise en charge",
  [ReportStatus.IN_TREATMENT]: "En cours de traitement",
  [ReportStatus.COMPLETED]: "Traité",
  [ReportStatus.CLOSED]: "Fermé",
};

interface ReportRow {
  id: string;
  createdAt: Date;
  status: ReportStatus;
  overdueAt: Date | null;
  area: { name: string };
  author: { firstName: string | null; lastName: string | null };
  coAuthors: { firstName: string | null; lastName: string | null }[];
  applicantTeam: {
    name: string;
    organization: { shortName: string } | null;
  };
  requestedTeams: { name: string; _count: { users: number } }[];
  _count: { answers: number };
  answers: { isIrrelevant: boolean; createdAt: Date }[];
  statusHistory: { status: ReportStatus; createdAt: Date }[];
}

// Cellule numérique (pas de chaîne « Xj et Yh ») pour que les utilisateurs
// puissent faire des stats sur les colonnes de délais dans Excel.
export function durationToDays(ms: number): number {
  return Math.round((ms / (1000 * 60 * 60 * 24)) * 100) / 100;
}

export function getClosingDate(
  statusHistory: { status: ReportStatus; createdAt: Date }[],
): Date | null {
  const closingEntry = [...statusHistory]
    .reverse()
    .find(
      (h) =>
        h.status === ReportStatus.COMPLETED || h.status === ReportStatus.CLOSED,
    );
  return closingEntry ? new Date(closingEntry.createdAt) : null;
}

export function getFirstTreatmentDate(
  statusHistory: { status: ReportStatus; createdAt: Date }[],
  firstAnswer: { createdAt: Date } | undefined,
): Date | null {
  const entry = statusHistory.find(
    (h) => h.status === ReportStatus.IN_TREATMENT,
  );
  if (entry) return new Date(entry.createdAt);
  // Fallback : date de la première réponse = prise en charge effective
  if (firstAnswer) return new Date(firstAnswer.createdAt);
  return null;
}

export function buildRows(reports: ReportRow[]): (string | number)[][] {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const headers = [
    "Lien du signalement",
    "Date de création",
    "Territoires",
    "État",
    "En souffrance",
    "Auteur",
    "Co-auteurs",
    "Équipe de l'auteur",
    "Organisation de l'auteur",
    "Nombre de destinataires",
    "Messages",
    "Signalement pertinent ?",
    "Date de fermeture",
    "Équipes d'opérateurs sollicitées",
    "Délais de prise en charge (jours)",
    "Délais de clôture (jours)",
  ];

  const rows = reports.map((report) => {
    const createdAt = new Date(report.createdAt);
    const closingDate = getClosingDate(report.statusHistory);
    const firstAnswer = report.answers[0];
    const treatmentDate = getFirstTreatmentDate(
      report.statusHistory,
      firstAnswer,
    );
    const relevance =
      report.status === ReportStatus.PENDING_ASSIGNMENT ||
      firstAnswer === undefined
        ? ""
        : firstAnswer.isIrrelevant
          ? "Non"
          : "Oui";
    const recipientCount = report.requestedTeams.reduce(
      (sum, t) => sum + t._count.users,
      0,
    );

    return [
      `${baseUrl}${ROUTE.REPORT}/${report.id}`,
      formatDate(createdAt),
      report.area.name,
      STATUS_LABELS[report.status],
      report.overdueAt ? "Oui" : "Non",
      `${report.author.lastName ?? ""} ${report.author.firstName ?? ""}`.trim(),
      report.coAuthors
        .map((c) => `${c.lastName ?? ""} ${c.firstName ?? ""}`.trim())
        .join(", "),
      report.applicantTeam.name,
      report.applicantTeam.organization?.shortName ?? "",
      String(recipientCount),
      String(report._count.answers),
      relevance,
      closingDate ? formatDate(closingDate) : "",
      report.requestedTeams.map((t) => t.name).join(", "),
      treatmentDate
        ? durationToDays(treatmentDate.getTime() - createdAt.getTime())
        : "",
      closingDate
        ? durationToDays(closingDate.getTime() - createdAt.getTime())
        : "",
    ];
  });

  return [headers, ...rows];
}

export function generateXlsx(reports: ReportRow[]): ArrayBuffer {
  const data = buildRows(reports);
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Signalements");
  const binary = XLSX.write(wb, { type: "binary", bookType: "xlsx" }) as string;
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i) & 0xff;
  }
  return buf;
}

function downloadXlsx(data: ArrayBuffer, filename: string) {
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportReports() {
  const trpc = useTRPC();

  const { data: areas } = useQuery(trpc.area.getMyAreas.queryOptions());

  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [truncationWarning, setTruncationWarning] = useState<string | null>(
    null,
  );
  const [exportError, setExportError] = useState<string | null>(null);
  const [emptyResult, setEmptyResult] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const exportMutation = useMutation(trpc.report.exportCsv.mutationOptions());

  if (!areas) return null;

  const hasMultipleAreas = areas.length > 1;
  const hasSingleArea = areas.length === 1;

  // Pré-sélectionner l'unique territoire si un seul
  const effectiveAreaIds = hasSingleArea ? [areas[0].id] : selectedAreaIds;

  const canExport = effectiveAreaIds.length > 0;

  async function handleExport() {
    setIsExporting(true);
    setTruncationWarning(null);
    setExportError(null);
    setEmptyResult(false);
    const params = {
      areaIds: effectiveAreaIds,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    try {
      // Pool de connexions Prisma sous charge : 1er appel peut timeout (10s),
      // on retente une fois après 1.5s pour laisser une connexion se libérer.
      let data;
      try {
        data = await exportMutation.mutateAsync(params);
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        data = await exportMutation.mutateAsync(params);
      }
      if (data.reports.length === 0) {
        setEmptyResult(true);
        return;
      }
      const xlsx = generateXlsx(data.reports as ReportRow[]);
      const now = new Date().toISOString().split("T")[0];
      downloadXlsx(xlsx, `signalements-${now}.xlsx`);

      if (data.totalCount > data.limit) {
        setTruncationWarning(
          `${data.totalCount} signalements correspondent à vos critères. L'export est limité à ${data.limit} signalements.  Utilisez les filtres (dates, territoires) pour réduire le nombre de signalements.`,
        );
      }
    } catch {
      setExportError(
        "Une erreur est survenue lors de l'export. Veuillez réessayer.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div
      id="export-reports"
      className="bg-white p-4 sm:p-8 md:p-12 lg:p-20 mb-6 mt-8 scroll-mt-4"
    >
      <h2 className="mb-6">Exporter les signalements</h2>

      <div className="flex flex-col gap-6 max-w-md">
        {hasMultipleAreas && (
          <MultiSelectAutocomplete
            id="export-territoire"
            label="Territoire"
            placeholder="Département(s)"
            options={areas}
            value={selectedAreaIds}
            onChange={setSelectedAreaIds}
            getOptionLabel={(option) => option.name}
            noOptionsText="Aucun département trouvé"
            chipsContainerAriaLabel="Territoires sélectionnés"
          />
        )}

        {hasSingleArea && (
          <div className="flex flex-col gap-2">
            <label className="fr-label">Territoire</label>
            <div>
              <Tag>{areas[0].name}</Tag>
            </div>
          </div>
        )}

        <Input
          label="Date de début (jj/mm/aaaa)"
          nativeInputProps={{
            type: "date",
            max: endDate || today,
            min: "2023-01-01",
            value: startDate,
            onChange: (e) => setStartDate(e.target.value),
          }}
        />

        <Input
          label="Date de fin (jj/mm/aaaa)"
          nativeInputProps={{
            type: "date",
            max: today,
            min: startDate || "2023-01-01",
            value: endDate,
            onChange: (e) => setEndDate(e.target.value),
          }}
        />

        <div>
          <Button
            size="large"
            iconId="fr-icon-download-line"
            disabled={!canExport || isExporting}
            onClick={handleExport}
          >
            {isExporting
              ? "Export en cours..."
              : "Exporter les signalements au format *.xlsx"}
          </Button>
        </div>

        {isExporting && (
          <Alert
            severity="info"
            description="Export en cours, veuillez patienter..."
            small
          />
        )}

        {exportError && (
          <Alert severity="error" description={exportError} small />
        )}

        {emptyResult && (
          <Alert
            severity="info"
            description="Aucun signalement ne correspond à vos critères."
            small
          />
        )}

        {truncationWarning && (
          <Alert
            severity="warning"
            title="Tous les signalements n'ont pas été exportés"
            description={truncationWarning}
            small
          />
        )}
      </div>
    </div>
  );
}
