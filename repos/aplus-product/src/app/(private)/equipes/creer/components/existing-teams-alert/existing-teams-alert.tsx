"use client";

import { useState, useMemo } from "react";
import Button from "@codegouvfr/react-dsfr/Button";

interface Area {
  id: string;
  name: string;
  inseeCode: string;
}

interface Organization {
  shortName: string;
}

export interface ExistingTeam {
  id: string;
  name: string;
  email: string | null;
  areas: Area[];
  organization: Organization;
}

type SortField = "name" | "territory" | "organization" | "email";
type SortDirection = "asc" | "desc";

interface ExistingTeamsAlertProps {
  teams: ExistingTeam[];
}

function formatAreas(areas: Area[]): string {
  if (areas.length > 2) {
    return `${areas
      .slice(0, 2)
      .map((a) => `${a.name} (${a.inseeCode})`)
      .join(", ")}...`;
  }
  return areas.map((a) => `${a.name} (${a.inseeCode})`).join(", ");
}

function getSortableTerritory(areas: Area[]): string {
  return areas[0]?.name.toLowerCase() ?? "";
}

export function ExistingTeamsAlert({ teams }: ExistingTeamsAlertProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      let valueA: string;
      let valueB: string;

      switch (sortField) {
        case "name":
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case "territory":
          valueA = getSortableTerritory(a.areas);
          valueB = getSortableTerritory(b.areas);
          break;
        case "organization":
          valueA = a.organization.shortName.toLowerCase();
          valueB = b.organization.shortName.toLowerCase();
          break;
        case "email":
          valueA = (a.email ?? "").toLowerCase();
          valueB = (b.email ?? "").toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortDirection === "asc") {
        return valueA.localeCompare(valueB);
      }
      return valueB.localeCompare(valueA);
    });
  }, [teams, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function getSortIcon(
    field: SortField,
  ): "ri-arrow-up-down-line" | "ri-arrow-up-line" | "ri-arrow-down-line" {
    if (sortField !== field) {
      return "ri-arrow-up-down-line";
    }
    return sortDirection === "asc" ? "ri-arrow-down-line" : "ri-arrow-up-line";
  }

  return (
    <div className="border border-[#b34000] flex mb-6">
      <div className="bg-[#b34000] flex items-start py-4 px-2">
        <span className="fr-icon-warning-fill text-white" />
      </div>
      <div className="flex flex-col gap-4 py-4 px-4 flex-1 min-w-0">
        <div>
          <p className="font-bold text-xl text-[#161616]">
            Équipes déjà existantes
          </p>
          <p className="text-[#3a3a3a]">
            Les équipes suivantes existent déjà sur Administration+. Veuillez
            vérifier que l&apos;équipe que vous souhaitez ajouter ne fait pas
            partie de la liste ci-dessous.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#929292]">
            <thead>
              <tr className="bg-[#F6F6F6]">
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-sm font-bold text-[#3a3a3a] border-b border-[#3a3a3a]"
                >
                  <Button
                    priority="tertiary no outline"
                    size="small"
                    iconId={getSortIcon("name")}
                    iconPosition="right"
                    onClick={() => handleSort("name")}
                    className="p-0 min-h-0"
                  >
                    Nom
                  </Button>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-sm font-bold text-[#3a3a3a] border-b border-[#3a3a3a]"
                >
                  <Button
                    priority="tertiary no outline"
                    size="small"
                    iconId={getSortIcon("territory")}
                    iconPosition="right"
                    onClick={() => handleSort("territory")}
                    className="p-0 min-h-0"
                  >
                    Territoire
                  </Button>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-sm font-bold text-[#3a3a3a] border-b border-[#3a3a3a]"
                >
                  <Button
                    priority="tertiary no outline"
                    size="small"
                    iconId={getSortIcon("organization")}
                    iconPosition="right"
                    onClick={() => handleSort("organization")}
                    className="p-0 min-h-0"
                  >
                    Organisation
                  </Button>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-sm font-bold text-[#3a3a3a] border-b border-[#3a3a3a]"
                >
                  <Button
                    priority="tertiary no outline"
                    size="small"
                    iconId={getSortIcon("email")}
                    iconPosition="right"
                    onClick={() => handleSort("email")}
                    className="p-0 min-h-0"
                  >
                    Adresse e-mail
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <tr
                  key={team.id}
                  className="border-b border-[#929292] bg-white"
                >
                  <td className="px-6 py-3 text-sm font-bold text-[#3a3a3a]">
                    {team.name}
                  </td>
                  <td className="px-6 py-3 text-sm text-[#3a3a3a]">
                    {formatAreas(team.areas)}
                  </td>
                  <td className="px-6 py-3 text-sm text-[#3a3a3a]">
                    {team.organization.shortName}
                  </td>
                  <td className="px-6 py-3 text-sm text-[#3a3a3a]">
                    {team.email || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
