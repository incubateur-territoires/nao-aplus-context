"use client";

import { useState, useMemo } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import Tag from "@codegouvfr/react-dsfr/Tag";

const MAX_VISIBLE_TEAMS = 5;

// Type minimal pour le filtre - on n'a besoin que de id et name
interface TeamForFilter {
  id: string;
  name: string;
}

interface ReportsTableTeamFilterProps {
  userTeams: TeamForFilter[];
  selectedTeams: string[];
  onTeamFilterChange: (teams: string[]) => void;
  // id de l'indication commune fournie par le parent (unique par instance).
  hintId?: string;
}

export function ReportsTableTeamFilter({
  userTeams,
  selectedTeams,
  onTeamFilterChange,
  hintId,
}: ReportsTableTeamFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  function handleTeamToggle(teamId: string) {
    if (selectedTeams.includes(teamId)) {
      onTeamFilterChange(selectedTeams.filter((t) => t !== teamId));
    } else {
      onTeamFilterChange([...selectedTeams, teamId]);
    }
  }

  // Ordre alphabétique fixe : la sélection ne doit pas réordonner les filtres
  const sortedTeams = useMemo(() => {
    return [...userTeams].sort((a, b) => a.name.localeCompare(b.name));
  }, [userTeams]);

  const visibleTeams = isExpanded
    ? sortedTeams
    : sortedTeams.slice(0, MAX_VISIBLE_TEAMS);
  const hiddenCount = sortedTeams.length - MAX_VISIBLE_TEAMS;
  const hasMoreTeams = hiddenCount > 0;

  if (userTeams.length <= 1) return null;

  return (
    <div
      className="flex items-baseline gap-2 flex-wrap"
      role="group"
      aria-label="Filtrer par équipe"
      aria-describedby={hintId}
    >
      <div className="flex flex-col sm:flex-row gap-2 sm:items-baseline sm:flex-nowrap">
        <p className="text-sm m-0 whitespace-nowrap">Par équipe :</p>
        <div className="flex items-center gap-2 flex-wrap">
          {visibleTeams.map((team) => (
            <Tag
              key={team.id}
              pressed={selectedTeams.includes(team.id)}
              nativeButtonProps={{
                onClick: (e) => {
                  e.preventDefault();
                  handleTeamToggle(team.id);
                },
                suppressHydrationWarning: true,
              }}
            >
              {team.name}
            </Tag>
          ))}
          {hasMoreTeams && (
            <Button
              type="button"
              size="small"
              priority="tertiary no outline"
              className="text-sm underline underline-offset-8 text-blue-primary p-0 bg-transparent"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded
                ? "Voir moins"
                : `+${hiddenCount} équipe${hiddenCount > 1 ? "s" : ""}`}
            </Button>
          )}
          {selectedTeams.length > 0 && (
            <Button
              type="button"
              size="small"
              priority="tertiary no outline"
              className="text-sm underline underline-offset-8 text-blue-primary p-0 bg-transparent"
              onClick={() => {
                onTeamFilterChange([]);
              }}
            >
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
