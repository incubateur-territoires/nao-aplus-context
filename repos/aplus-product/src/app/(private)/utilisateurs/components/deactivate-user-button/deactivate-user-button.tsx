"use client";

import { useMemo } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

interface DeactivateUserButtonProps {
  userId: string;
  onDeactivateUser: (userId: string) => void;
  size?: "small" | "medium" | "large";
}

export function DeactivateUserButton({
  userId,
  onDeactivateUser,
  size = "small",
}: DeactivateUserButtonProps) {
  const modal = useMemo(
    () =>
      createModal({
        id: `deactivate-user-modal-${userId}`,
        isOpenedByDefault: false,
      }),
    [userId],
  );

  return (
    <>
      <Button
        type="button"
        priority="secondary"
        size={size}
        iconId="ri-user-unfollow-line"
        onClick={() => modal.open()}
      >
        Désactiver l&apos;utilisateur
      </Button>
      <modal.Component
        title="Désactiver l'utilisateur"
        buttons={[
          {
            doClosesModal: true,
            children: "Annuler",
            priority: "secondary",
          },
          {
            doClosesModal: false,
            children: "Désactiver le compte",
            onClick: () => {
              onDeactivateUser(userId);
              modal.close();
            },
          },
        ]}
      >
        <p>
          Si l&apos;utilisateur fait partie de plusieurs équipes, il sera
          désactivé pour toutes ces équipes.
        </p>
        <p>
          Si l&apos;utilisateur est auteur de signalements, ces signalements
          seront transférés à d&apos;autres membres de son équipe.
        </p>
        <p>
          Si l&apos;utilisateur a participé à des conversations, les autres
          participants seront avertis de son retrait.
        </p>
        <p>
          Cette action est réversible : vous pourrez réactiver un utilisateur si
          nécessaire.
        </p>
        {process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === "true" && (
          <DeactivationDebugPreview userId={userId} />
        )}
      </modal.Component>
    </>
  );
}

const SCENARIO_LABELS: Record<string, string> = {
  AUTHOR_TRANSFER: "Transfert de propriété",
  AUTHOR_WITH_COAUTHORS: "Notification aux co-auteurs",
  AUTHOR_ALONE_CLOSE: "Clôture (auteur seul sans équipe)",
  COAUTHOR_ONLY: "Retrait comme co-auteur",
  RECIPIENT_ALONE_CLOSE: "Clôture (destinataire seul)",
  RECIPIENT_HANDLED_REVERT: "Retour en attente d'affectation",
  RECIPIENT_NOT_HANDLED: "Notification simple",
};

function DeactivationDebugPreview({ userId }: { userId: string }) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.user.previewDeactivation.queryOptions({ userId }),
  );

  if (isLoading) {
    return (
      <div style={{ marginTop: 16, padding: 8, background: "#f5f5f5" }}>
        Chargement de l&apos;aperçu...
      </div>
    );
  }

  if (!data) return null;

  const transferCount = data.scenarios.filter(
    (s) => s.type === "AUTHOR_TRANSFER",
  ).length;
  const closeCount = data.scenarios.filter(
    (s) =>
      s.type === "AUTHOR_ALONE_CLOSE" || s.type === "RECIPIENT_ALONE_CLOSE",
  ).length;
  const notificationCount = data.scenarios.filter(
    (s) =>
      s.type === "COAUTHOR_ONLY" ||
      s.type === "AUTHOR_WITH_COAUTHORS" ||
      s.type === "RECIPIENT_NOT_HANDLED",
  ).length;
  const revertCount = data.scenarios.filter(
    (s) => s.type === "RECIPIENT_HANDLED_REVERT",
  ).length;

  return (
    <details
      style={{
        marginTop: 16,
        padding: 12,
        background: "#fff3e0",
        border: "1px solid #ffcc80",
        borderRadius: 4,
      }}
    >
      <summary
        style={{ cursor: "pointer", fontWeight: "bold", color: "#b34000" }}
      >
        <h3
          style={{
            display: "inline",
            margin: 0,
            fontSize: "inherit",
            fontWeight: "inherit",
            color: "inherit",
          }}
        >
          Debug: Aperçu de la désactivation
        </h3>
      </summary>

      <div style={{ marginTop: 12, fontSize: 14 }}>
        {data.teams.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Équipes (sera retiré de) :
            </h4>
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
              {data.teams.map((team, i) => (
                <li key={i}>{team}</li>
              ))}
            </ul>
          </div>
        )}

        {data.managedTeams.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Équipes gérées (ne sera plus responsable) :
            </h4>
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
              {data.managedTeams.map((team, i) => {
                const transfer = data.managerTransfers?.find(
                  (t) => t.teamName === team,
                );
                return (
                  <li key={i}>
                    {team}
                    {transfer?.hasOtherManagers && (
                      <span style={{ color: "#666" }}>
                        {" "}
                        — d&apos;autres responsables existent
                      </span>
                    )}
                    {transfer &&
                      !transfer.hasOtherManagers &&
                      transfer.newManagerName && (
                        <span style={{ color: "#2e7d32" }}>
                          {" "}
                          → transféré à{" "}
                          <strong>{transfer.newManagerName}</strong>
                        </span>
                      )}
                    {transfer &&
                      !transfer.hasOtherManagers &&
                      !transfer.newManagerName && (
                        <span style={{ color: "#d32f2f" }}>
                          {" "}
                          ⚠ aucun membre actif pour reprendre le rôle
                        </span>
                      )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {data.scenarios.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Résumé des impacts sur les signalements :
            </h4>
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
              {transferCount > 0 && (
                <li>
                  {transferCount} signalement(s) transféré(s) à un autre membre
                </li>
              )}
              {closeCount > 0 && (
                <li>{closeCount} signalement(s) clôturé(s)</li>
              )}
              {notificationCount > 0 && (
                <li>{notificationCount} notification(s) envoyée(s)</li>
              )}
              {revertCount > 0 && (
                <li>
                  {revertCount} signalement(s) remis en attente
                  d&apos;affectation
                </li>
              )}
            </ul>
          </div>
        )}

        {data.scenarios.length > 0 && (
          <div>
            <h4 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Détail par signalement :
            </h4>
            <ul
              style={{
                marginTop: 8,
                maxHeight: 200,
                overflow: "auto",
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
                  <div style={{ fontWeight: 500 }}>
                    {scenario.reportSubject}
                  </div>
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
                    {scenario.type === "AUTHOR_TRANSFER" &&
                      "newAuthor" in scenario && (
                        <span style={{ color: "#333" }}>
                          {" "}
                          vers <strong>{scenario.newAuthor}</strong>
                        </span>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.scenarios.length === 0 && (
          <div style={{ fontStyle: "italic", color: "#666" }}>
            Aucun signalement actif affecté par cette désactivation.
          </div>
        )}
      </div>
    </details>
  );
}
