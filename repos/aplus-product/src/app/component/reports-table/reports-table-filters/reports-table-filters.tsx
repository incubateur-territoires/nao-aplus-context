"use client";

import { ReportStatus } from "@/generated/prisma/enums";
import Button from "@codegouvfr/react-dsfr/Button";
import ToggleSwitch from "@codegouvfr/react-dsfr/ToggleSwitch";
import { ROUTE } from "@/app/constant/route";
import { useId, useMemo } from "react";
import { FullUser } from "@/types/user";
import { useRouter } from "next/navigation";
import { ReportsTableSearch } from "../reports-table-search/reports-table-search";
import { ReportsTableTeamFilter } from "../reports-table-team-filter/reports-table-team-filter";
import { ReportsTableStatusFilter } from "../reports-table-status-filter/reports-table-status-filter";
import { ReportMode } from "@/types/report-mode";
import { USER_ROLES } from "@/constants/user-roles";

interface ReportsTableFiltersProps {
  selectedMyAnsweredReports: boolean;
  handleMyAnsweredReportsToggle: () => void;
  selectedStatuses: ReportStatus[];
  onStatusFilterChange: (statuses: ReportStatus[]) => void;
  selectedTeams: string[];
  onTeamFilterChange: (teams: string[]) => void;
  totalCount: number;
  handleMyReportsToggle: () => void;
  selectedMyReports: boolean;
  currentUser: FullUser | null | undefined;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  mode: ReportMode;
  selectedOverdueOnly: boolean;
  handleOverdueToggle: () => void;
}

export function ReportsTableFilters({
  currentUser,
  selectedStatuses,
  onStatusFilterChange,
  selectedTeams,
  onTeamFilterChange,
  handleMyReportsToggle,
  selectedMyReports,
  searchQuery,
  setSearchQuery,
  mode,
  selectedMyAnsweredReports,
  handleMyAnsweredReportsToggle,
  selectedOverdueOnly,
  handleOverdueToggle,
}: ReportsTableFiltersProps) {
  const router = useRouter();

  // id unique de l'indication : ce bloc de filtres est monté plusieurs fois
  // sur la même page (signalements créés + à examiner). Chaque instance a donc
  // son propre id, propagé aux filtres qui le référencent via aria-describedby.
  const filtersHintId = useId();

  // Utiliser les équipes de l'utilisateur courant
  const userTeams = useMemo(() => {
    if (!currentUser?.teams) return [];
    return currentUser.teams.map((team) => ({
      id: team.id,
      name: team.name,
    }));
  }, [currentUser?.teams]);

  // Tous les statuts possibles (ordre défini)
  const allStatuses = useMemo(() => {
    return [
      ReportStatus.PENDING_ASSIGNMENT,
      ReportStatus.IN_TREATMENT,
      ReportStatus.COMPLETED,
      ReportStatus.CLOSED,
    ];
  }, []);

  return (
    <div className="flex gap-4 flex-wrap items-baseline mb-8 flex-col ">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between w-full">
        <h2>
          {mode === ReportMode.CREATED
            ? "Signalements créés par votre équipe"
            : "Signalements à examiner"}
        </h2>

        {currentUser?.role !== USER_ROLES.SUPERVISOR && (
          <Button
            size="large"
            priority="secondary"
            className="hover:bg-blue-primary hover:text-white sm:whitespace-nowrap"
            iconId="ri-add-line"
            onClick={() => {
              router.push(ROUTE.NEW_REPORT_STEP_1);
            }}
          >
            Créer un nouveau signalement
          </Button>
        )}
      </div>
      <div className="w-full sm:w-1/2 mb-10">
        <ReportsTableSearch
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>

      <p id={filtersHintId} className="sr-only">
        Les résultats se mettent à jour automatiquement à l&apos;activation
        d&apos;un filtre.
      </p>
      <fieldset className="w-full border-0 p-0 m-0">
        <legend className="fr-h6 mb-0">Filtrer les signalements</legend>
        {mode === ReportMode.CREATED ? (
          <ToggleSwitch
            className="mt-2 [&_label]:!w-fit [&_label]:!max-w-full"
            showCheckedHint={false}
            checked={selectedMyReports}
            onChange={handleMyReportsToggle}
            label="Voir uniquement les signalements que vous avez créés"
          />
        ) : (
          <ToggleSwitch
            className="mt-2 [&_label]:!w-fit [&_label]:!max-w-full"
            showCheckedHint={false}
            checked={selectedMyAnsweredReports}
            onChange={handleMyAnsweredReportsToggle}
            label="Voir uniquement les signalements auxquels vous avez répondu"
          />
        )}
        <ToggleSwitch
          className="mt-2 [&_label]:!w-fit [&_label]:!max-w-full"
          showCheckedHint={false}
          checked={selectedOverdueOnly}
          onChange={handleOverdueToggle}
          label="Voir uniquement les signalements en souffrance"
        />
      </fieldset>

      <ReportsTableTeamFilter
        selectedTeams={selectedTeams}
        onTeamFilterChange={onTeamFilterChange}
        userTeams={userTeams}
        hintId={filtersHintId}
      />

      <ReportsTableStatusFilter
        allStatuses={allStatuses}
        selectedStatuses={selectedStatuses}
        onStatusFilterChange={onStatusFilterChange}
        hintId={filtersHintId}
      />
    </div>
  );
}
