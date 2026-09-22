"use client";

import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ReportStatus } from "@/generated/prisma/enums";
import { useTRPC } from "@/trpc/client";
import { ROUTE } from "@/app/constant/route";
import { formatDelayDaysToText } from "@/utils/format";
import { StatCard } from "./stat-card/stat-card";

interface StatsBannerProps {
  canExport: boolean;
}

// Ancres de scroll posées sur les conteneurs de tableaux / d'export.
export const TABLE_CREATED_ID = "table-created";
export const TABLE_REQUESTED_ID = "table-requested";
export const EXPORT_REPORTS_ID = "export-reports";

// Filtre déclenché par le clic sur une carte.
type CardFilter = { status: ReportStatus } | { overdue: true };

function scrollToId(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function StatsBanner({ canExport }: StatsBannerProps) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: stats } = useQuery({
    ...trpc.report.getMyReportsStats.queryOptions(),
    staleTime: 5 * 60_000,
  });
  const { data: teamStats } = useQuery({
    ...trpc.report.getMyTeamStats.queryOptions(),
    staleTime: 5 * 60_000,
  });
  const { data: currentUser } = useQuery(
    trpc.user.getCurrentUser.queryOptions(),
  );

  // Un périmètre est « actif » (profil possédé par l'utilisateur) si total > 0.
  const createdActive = (stats?.created?.total ?? 0) > 0;
  const requestedActive = (stats?.requested?.total ?? 0) > 0;
  const hasAnyScope = createdActive || requestedActive;

  const handleCardClick = useCallback(
    (filter: CardFilter) => {
      const params = new URLSearchParams(searchParams.toString());

      // Applique le filtre aux périmètres possédés par l'utilisateur (préfixe
      // `c_` pour les créés, `r_` pour les à examiner).
      const prefixes: string[] = [];
      if (createdActive) prefixes.push("c_");
      if (requestedActive) prefixes.push("r_");

      for (const prefix of prefixes) {
        if ("overdue" in filter) {
          params.set(`${prefix}overdue`, "1");
          params.delete(`${prefix}status`);
        } else {
          params.set(`${prefix}status`, filter.status);
          params.delete(`${prefix}overdue`);
        }
        params.delete(`${prefix}page`);
      }

      // Défilement immédiat (réactif), puis application du filtre. Le tableau
      // conserve ses lignes pendant le refetch (placeholderData), donc pas de
      // « trou » visuel. Ciblage selon le profil : créés en priorité.
      scrollToId(createdActive ? TABLE_CREATED_ID : TABLE_REQUESTED_ID);

      // Native History API : applique le filtre côté client (React Query refetch
      // via `useSearchParams`) sans re-exécuter le prefetch du Server Component.
      const nextQs = params.toString();
      const url = nextQs ? `${pathname}?${nextQs}` : pathname;
      window.history.replaceState(null, "", url);
    },
    [searchParams, createdActive, requestedActive, pathname],
  );

  // Compteurs agrégés (créés + à examiner), relatifs à l'utilisateur.
  const sum = (key: "pending" | "inTreatment" | "treated" | "overdue") =>
    (stats?.created?.[key] ?? 0) + (stats?.requested?.[key] ?? 0);

  const cards = (
    <div className="flex flex-col gap-5 sm:flex-row">
      <StatCard
        value={sum("overdue")}
        label="en souffrance"
        variant="overdue"
        onClick={
          hasAnyScope ? () => handleCardClick({ overdue: true }) : undefined
        }
      />
      <StatCard
        value={sum("pending")}
        label="en attente de prise en charge"
        onClick={
          hasAnyScope
            ? () => handleCardClick({ status: ReportStatus.PENDING_ASSIGNMENT })
            : undefined
        }
      />
      <StatCard
        value={sum("inTreatment")}
        label="en cours de traitement"
        onClick={
          hasAnyScope
            ? () => handleCardClick({ status: ReportStatus.IN_TREATMENT })
            : undefined
        }
      />
      <StatCard
        value={sum("treated")}
        label="traités"
        onClick={
          hasAnyScope
            ? () => handleCardClick({ status: ReportStatus.COMPLETED })
            : undefined
        }
      />
    </div>
  );

  const teamCount = currentUser?.teams?.length ?? teamStats?.teamCount ?? 0;
  const isPlural = teamCount > 1;
  const teamTabLabel = isPlural
    ? "Statistiques de vos équipes"
    : "Statistiques de votre équipe";

  const hasTeamStats =
    teamStats != null &&
    (teamStats.avgAssignmentDays != null || teamStats.avgTreatmentDays != null);

  const teamTab = (
    <div className="flex flex-col gap-2">
      {hasTeamStats ? (
        <>
          <p className="text-sm m-0 ">
            Délai moyen de prise en charge :{" "}
            <strong>
              {teamStats.avgAssignmentDays != null
                ? formatDelayDaysToText(teamStats.avgAssignmentDays)
                : "non disponible"}
            </strong>
          </p>
          <p className="text-sm m-0 ">
            Délai moyen de traitement :{" "}
            <strong>
              {teamStats.avgTreatmentDays != null
                ? formatDelayDaysToText(teamStats.avgTreatmentDays)
                : "non disponible"}
            </strong>
          </p>
          <Link
            href={ROUTE.STATISTIQUES}
            className="fr-link fr-icon-arrow-right-line fr-link--icon-left mt-2 w-fit text-sm"
          >
            Voir toutes les statistiques
          </Link>
          {canExport && (
            <a
              href={`#${EXPORT_REPORTS_ID}`}
              className="fr-link fr-icon-download-line fr-link--icon-left mt-4 w-fit text-sm"
            >
              Exporter les signalements
            </a>
          )}
        </>
      ) : (
        <p className="text-sm leading-6 text-[#3a3a3a]">
          Les statistiques de {isPlural ? "vos équipes" : "votre équipe"} ne
          sont pas encore disponibles.
        </p>
      )}
    </div>
  );

  return (
    <div className="mt-6">
      <Tabs
        tabs={[
          { label: "Vos signalements", content: cards, isDefault: true },
          { label: teamTabLabel, content: teamTab },
        ]}
      />
    </div>
  );
}
