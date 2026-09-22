import type { ReactNode } from "react";
import { TeamType } from "@/generated/prisma/enums";

export const TEAM_TYPE_LABELS: Record<TeamType, string> = {
  OPERATOR: "Opérateurs",
  FRANCE_SERVICE: "France Services",
  HISTORICAL_SOCIAL_WORKER: "Travailleurs sociaux historiques",
  TZNR: "TZNR",
  OTHERS_HELPERS: "Autres aidants",
};

export const ACCEPT_TYPE_LABELS: Record<TeamType, string> = {
  FRANCE_SERVICE: "de France Services (par défaut)",
  HISTORICAL_SOCIAL_WORKER: "des travailleurs sociaux historiques (par défaut)",
  OPERATOR: "des autres opérateurs (par défaut)",
  TZNR: "des TZNR",
  OTHERS_HELPERS: "des autres aidants",
};

export const ACCEPT_TYPE_HINTS: Record<TeamType, ReactNode> = {
  FRANCE_SERVICE: (
    <>
      Ensemble du réseau France Services.
      <strong> Ne pas décocher sauf cas très particulier.</strong>
    </>
  ),
  HISTORICAL_SOCIAL_WORKER: (
    <>
      Les travailleurs sociaux présents sur Administration+ depuis 2019.
      <strong> Ne pas décocher sauf cas très particulier.</strong>
    </>
  ),
  OPERATOR: (
    <>
      Les autres opérateurs présents sur Administration+.{" "}
      <strong>Ne pas décocher sauf cas très particulier</strong>
    </>
  ),
  TZNR: (
    <>
      Territoires Zéro Non-Recours. À cocher lorsque votre organisation
      participe à une{" "}
      <a
        target="_blank"
        href="https://docs.aplus.beta.gouv.fr/comprendre-administration-plus/lexique-glossaire#tznr"
      >
        {" "}
        expérimentation TZNR
        <span className="sr-only"> - nouvelle fenêtre</span>
      </a>
      .
    </>
  ),
  OTHERS_HELPERS: (
    <>
      Les travailleurs sociaux et tous les autres types d’aidants créés à partir
      de 2026.
    </>
  ),
};

export const ACCEPT_TYPES_ORDER: TeamType[] = [
  TeamType.FRANCE_SERVICE,
  TeamType.HISTORICAL_SOCIAL_WORKER,
  TeamType.OPERATOR,
  TeamType.TZNR,
  TeamType.OTHERS_HELPERS,
];

export const TEAM_TYPE_OPTIONS = Object.entries(TEAM_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as TeamType, label }),
);
