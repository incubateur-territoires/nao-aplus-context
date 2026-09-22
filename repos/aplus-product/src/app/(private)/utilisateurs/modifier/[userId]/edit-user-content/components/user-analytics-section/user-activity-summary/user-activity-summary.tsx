"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { formatToLongDate, formatRelativeToNow } from "@/utils/format";

interface UserActivitySummaryProps {
  userId: string;
  timeZone: string;
}

export function UserActivitySummary({
  userId,
  timeZone,
}: UserActivitySummaryProps) {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.analytics.getUserActivitySummary.queryOptions({ userId }),
  );

  if (!data) return null;

  function formatDate(date: Date | string): string {
    return formatToLongDate(date, timeZone);
  }

  function formatActor(actorName: string | null): string {
    return actorName ?? "un utilisateur inconnu";
  }

  const facts: string[] = [];

  // Affichée uniquement si une connexion est connue ; sinon on n'affiche rien
  // (une absence d'event ne prouve pas que l'utilisateur ne s'est jamais connecté).
  if (data.lastSignInAt) {
    const browser = data.lastSignInBrowser
      ? ` depuis ${data.lastSignInBrowser}`
      : "";
    facts.push(
      `Dernière connexion le ${formatDate(data.lastSignInAt)}${browser} (${formatRelativeToNow(data.lastSignInAt)}).`,
    );
  }

  // Activité ≠ connexion : une session reste ouverte plusieurs jours, un
  // utilisateur peut donc être actif sans nouvelle connexion (et inversement).
  if (data.lastActivityAt) {
    facts.push(
      `Dernière activité le ${formatDate(data.lastActivityAt)} (${formatRelativeToNow(data.lastActivityAt)}).`,
    );
  }

  if (data.accountCreatedAt) {
    facts.push(`Compte créé le ${formatDate(data.accountCreatedAt)}.`);
  }

  // On affiche la dernière action de statut (désactivation ou réactivation),
  // celle qui reflète l'état courant du compte.
  const deactivatedAt = data.lastDeactivation?.at
    ? new Date(data.lastDeactivation.at).getTime()
    : null;
  const reactivatedAt = data.lastReactivation?.at
    ? new Date(data.lastReactivation.at).getTime()
    : null;

  if (
    data.lastDeactivation &&
    (reactivatedAt === null || (deactivatedAt ?? 0) >= reactivatedAt)
  ) {
    facts.push(
      `Compte désactivé par ${formatActor(data.lastDeactivation.actorName)} le ${formatDate(data.lastDeactivation.at)}.`,
    );
  } else if (data.lastReactivation) {
    facts.push(
      `Compte réactivé par ${formatActor(data.lastReactivation.actorName)} le ${formatDate(data.lastReactivation.at)}.`,
    );
  }

  if (data.reportsCreatedCount > 0) {
    facts.push(
      `${data.reportsCreatedCount} signalement${data.reportsCreatedCount > 1 ? "s" : ""} créé${data.reportsCreatedCount > 1 ? "s" : ""}.`,
    );
  }

  return (
    <div className="mb-6 rounded border-l-4 border-blue-primary bg-[#F6F6F6] p-4">
      <h3 className="fr-h6 mb-2">En bref</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {facts.map((fact) => (
          <li key={fact} className="text-sm">
            {fact}
          </li>
        ))}
      </ul>
    </div>
  );
}
