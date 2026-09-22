"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

const SCENARIO_LABELS: Record<string, string> = {
  APPLICANT_TEAM_CLOSED: "Clôture (équipe demandeuse)",
  REQUESTED_TEAM_REMOVED: "Notification (retrait équipe destinataire)",
  REQUESTED_TEAM_SOLE_CLOSED: "Clôture (seule équipe destinataire)",
};

export function TeamDeletionPreview({ teamId }: { teamId: string }) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.team.previewDeleteTeam.queryOptions(teamId),
  );

  if (isLoading) {
    return (
      <div style={{ marginTop: 16, padding: 8, background: "#f5f5f5" }}>
        Chargement de l&apos;aperçu des impacts...
      </div>
    );
  }

  if (!data) return null;

  const closeCount = data.scenarios.filter(
    (s) =>
      s.type === "APPLICANT_TEAM_CLOSED" ||
      s.type === "REQUESTED_TEAM_SOLE_CLOSED",
  ).length;
  const notificationCount = data.scenarios.filter(
    (s) => s.type === "REQUESTED_TEAM_REMOVED",
  ).length;

  if (data.scenarios.length === 0) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: 12,
          background: "#f5f5f5",
          borderRadius: 4,
          fontStyle: "italic",
          color: "#666",
        }}
      >
        Aucun signalement actif affecté.
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        background: "#fff3e0",
        border: "1px solid #ffcc80",
        borderRadius: 4,
      }}
    >
      <div style={{ fontWeight: "bold", color: "#b34000", marginBottom: 8 }}>
        Impact sur les signalements actifs
      </div>

      <div style={{ marginBottom: 12, fontSize: 14 }}>
        <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
          {closeCount > 0 && <li>{closeCount} signalement(s) clôturé(s)</li>}
          {notificationCount > 0 && (
            <li>{notificationCount} notification(s) envoyée(s)</li>
          )}
        </ul>
      </div>

      <details>
        <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
          Détail par signalement
        </summary>
        <ul
          style={{
            marginTop: 8,
            background: "#fff",
            padding: 8,
            borderRadius: 4,
            listStyle: "none",
          }}
        >
          {data.scenarios.map((scenario, i) => (
            <li
              key={i}
              style={{
                padding: "8px 0",
                borderBottom:
                  i < data.scenarios.length - 1 ? "1px solid #eee" : "none",
              }}
            >
              <div style={{ fontWeight: 500 }}>{scenario.reportSubject}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                Usager : {scenario.reportApplicant}
              </div>
              <div
                style={{
                  fontSize: 12,
                  marginTop: 4,
                  color: "#b34000",
                }}
              >
                → {SCENARIO_LABELS[scenario.type] || scenario.type}
              </div>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
