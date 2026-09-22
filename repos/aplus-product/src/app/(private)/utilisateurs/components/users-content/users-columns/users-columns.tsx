import type { ColumnDef } from "@tanstack/react-table";
import Button from "@codegouvfr/react-dsfr/Button";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { ActionMenu } from "@/app/component/action-menu/action-menu";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { USER_ROLES, type UserRole } from "@/constants/user-roles";
import Link from "next/link";
import { ROUTE } from "@/app/constant/route";
import { useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EditUserButton } from "./edit-user-button";
import { normalizeSearchQuery } from "@/utils/normalize";

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  profession?: string | null;
  isInactive: boolean;
  isPending?: boolean;
  role: UserRole;
  isManager: boolean;
  teams: {
    id: string;
    name: string;
    areas: { id: string; name: string; inseeCode?: string | null }[];
  }[];
  supervisorAreas?: { id: string; name: string; inseeCode?: string | null }[];
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;

  const normalizedText = normalizeSearchQuery(text);
  const words = query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => normalizeSearchQuery(word));

  if (words.length === 0) return text;

  // Find all match positions in the normalized text
  const matches: { start: number; end: number }[] = [];
  for (const word of words) {
    let pos = 0;
    while ((pos = normalizedText.indexOf(word, pos)) !== -1) {
      matches.push({ start: pos, end: pos + word.length });
      pos += 1;
    }
  }

  if (matches.length === 0) return text;

  // Sort and merge overlapping matches
  matches.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const match of matches) {
    const last = merged[merged.length - 1];
    if (last && match.start <= last.end) {
      last.end = Math.max(last.end, match.end);
    } else {
      merged.push({ ...match });
    }
  }

  // Build result with highlighted parts
  const result: React.ReactNode[] = [];
  let lastEnd = 0;
  for (let i = 0; i < merged.length; i++) {
    const { start, end } = merged[i];
    if (start > lastEnd) {
      result.push(text.slice(lastEnd, start));
    }
    result.push(
      <mark key={i} className="bg-blue-200">
        {text.slice(start, end)}
      </mark>,
    );
    lastEnd = end;
  }
  if (lastEnd < text.length) {
    result.push(text.slice(lastEnd));
  }

  return result;
}

export function getUsersColumns(
  onDeactivateUser: (userId: string) => void,
  onReactivateUser: (userId: string) => void,
  canEditUsers: boolean = false,
  canDeactivateUsers: boolean = false,
  currentUserId?: string,
  searchQuery: string = "",
  onResendSuccess?: () => void,
  canEditUserDetails: boolean = false,
  onResendError?: (message: string) => void,
): ColumnDef<UserRow>[] {
  const columns: ColumnDef<UserRow>[] = [];

  if (canEditUserDetails) {
    columns.push({
      id: "edit",
      header: "",
      cell: ({ row }) =>
        row.original.isPending ? null : (
          <EditUserButton userId={row.original.id} />
        ),
      enableSorting: false,
    });
  }

  columns.push(
    {
      id: "member",
      header: () => (
        <div>
          <div>Nom du membre</div>
          <div className="text-xs font-normal text-[#3A3A3A] mt-1">
            Adresse e-mail
          </div>
        </div>
      ),
      accessorFn: (row) => row.fullName,
      meta: { sortType: "alpha" },
      cell: ({ row }) => (
        <div className="max-w-[260px]">
          <div className="font-bold break-words">
            {highlightText(row.original.fullName, searchQuery)}
          </div>
          <div className="text-sm text-[#3A3A3A] mt-1 break-all">
            {highlightText(row.original.email, searchQuery)}
          </div>
        </div>
      ),
      enableSorting: true,
    },
    {
      id: "teams",
      header: "Équipe(s)",
      accessorFn: (row) => row.teams.map((t) => t.name).join(", "),
      cell: ({ row }) => <TeamsCell teams={row.original.teams} />,
      enableSorting: false,
    },
    {
      id: "territories",
      header: "Territoire(s)",
      accessorFn: (row) => {
        const sourceAreas =
          row.role === USER_ROLES.SUPERVISOR && row.supervisorAreas
            ? row.supervisorAreas
            : row.teams.flatMap((t) => t.areas);
        return sourceAreas.map((a) => a.name).join(", ");
      },
      cell: ({ row }) => {
        const sourceAreas =
          row.original.role === USER_ROLES.SUPERVISOR &&
          row.original.supervisorAreas
            ? row.original.supervisorAreas
            : row.original.teams.flatMap((team) => team.areas);
        const uniqueAreas = sourceAreas.filter(
          (area, index, self) =>
            self.findIndex((a) => a.id === area.id) === index,
        );
        return <TerritoriesCell areas={uniqueAreas} />;
      },
      enableSorting: false,
    },
    {
      id: "role",
      header: () => (
        <div>
          <div>Rôle</div>
          <div className="text-xs font-normal text-[#666] mt-1">Profession</div>
        </div>
      ),
      accessorFn: (row) => row.role,
      sortingFn: (rowA, rowB) => {
        const ROLE_PRIORITY: Record<string, number> = {
          [USER_ROLES.ADMIN]: 0,
          [USER_ROLES.SUPERVISOR]: 1,
        };
        const priorityA =
          ROLE_PRIORITY[rowA.original.role] ??
          (rowA.original.isManager ? 2 : 3);
        const priorityB =
          ROLE_PRIORITY[rowB.original.role] ??
          (rowB.original.isManager ? 2 : 3);
        return priorityA - priorityB;
      },
      cell: ({ row }) => {
        const { role, isManager, isInactive, isPending } = row.original;

        function getRoleBadges() {
          const badges: React.ReactNode[] = [];

          if (isPending) {
            badges.push(
              <Badge key="pending" severity="warning" noIcon small>
                EN ATTENTE
              </Badge>,
            );
          }

          if (isInactive) {
            badges.push(
              <Badge key="inactive" severity="error" noIcon small>
                DÉSACTIVÉ
              </Badge>,
            );
          }

          if (role === USER_ROLES.ADMIN) {
            badges.push(
              <Badge key="admin" severity="new" noIcon small>
                ADMIN
              </Badge>,
            );
          } else if (role === USER_ROLES.SUPERVISOR) {
            badges.push(
              <Badge key="supervisor" severity="new" noIcon small>
                SUPERVISEUR
              </Badge>,
            );
          } else if (isManager) {
            badges.push(
              <Badge key="manager" severity="info" noIcon small>
                RESPONSABLE
              </Badge>,
            );
          }

          if (badges.length === 0) return null;
          if (badges.length === 1) return badges[0];

          return <div className="flex flex-col gap-2">{badges}</div>;
        }

        return (
          <div>
            {getRoleBadges()}
            {row.original.profession && (
              <div className="text-sm mt-1">{row.original.profession}</div>
            )}
          </div>
        );
      },
      enableSorting: true,
    },
  );

  if (canEditUsers || canDeactivateUsers) {
    columns.push({
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const { role, isInactive, isPending } = row.original;

        if (isPending) {
          if (!canEditUsers) return null;
          return (
            <PendingInvitationActions
              pendingUserId={row.original.id}
              pendingUserEmail={row.original.email}
              onResendSuccess={onResendSuccess}
              onResendError={onResendError}
            />
          );
        }

        if (!canDeactivateUsers) return null;

        // Cannot deactivate admins or yourself
        if (role === USER_ROLES.ADMIN || row.original.id === currentUserId) {
          return null;
        }

        if (isInactive) {
          return (
            <ReactivateUserButton
              userId={row.original.id}
              userEmail={row.original.email}
              onReactivateUser={onReactivateUser}
            />
          );
        }

        return (
          <DeactivateUserButton
            userId={row.original.id}
            userEmail={row.original.email}
            onDeactivateUser={onDeactivateUser}
          />
        );
      },
      enableSorting: false,
    });
  }

  return columns;
}

const MAX_VISIBLE_ITEMS = 4;

function TeamsCell({ teams }: { teams: UserRow["teams"] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? teams : teams.slice(0, MAX_VISIBLE_ITEMS);
  const remaining = teams.length - MAX_VISIBLE_ITEMS;

  return (
    <div className="flex flex-col gap-1">
      {visible.map((team) => (
        <Link
          key={team.id}
          href={`${ROUTE.TEAMS}/${team.id}`}
          className="inline-block w-fit max-w-[200px] truncate text-blue-primary"
        >
          {team.name}
        </Link>
      ))}
      {remaining > 0 && (
        <button
          type="button"
          className="text-xs text-blue-primary hover:bg-transparent text-left cursor-pointer underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Voir moins"
            : `+${remaining} équipe${remaining > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}

function TerritoriesCell({
  areas,
}: {
  areas: { id: string; name: string; inseeCode?: string | null }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? areas : areas.slice(0, MAX_VISIBLE_ITEMS);
  const remaining = areas.length - MAX_VISIBLE_ITEMS;

  return (
    <div className="flex flex-col gap-1">
      {visible.map((area) => (
        <span key={area.id} className="w-fit text-[#3A3A3A]">
          {area.name}
          {area.inseeCode ? ` (${area.inseeCode})` : ""}
        </span>
      ))}
      {remaining > 0 && (
        <button
          type="button"
          className="text-xs text-blue-primary hover:bg-transparent text-left cursor-pointer underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Voir moins"
            : `+${remaining} territoire${remaining > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}

function PendingInvitationActions({
  pendingUserId,
  pendingUserEmail,
  onResendSuccess,
  onResendError,
}: {
  pendingUserId: string;
  pendingUserEmail: string;
  onResendSuccess?: () => void;
  onResendError?: (message: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const cancelModal = useMemo(
    () =>
      createModal({
        id: `cancel-invitation-modal-${pendingUserId}`,
        isOpenedByDefault: false,
      }),
    [pendingUserId],
  );

  const { mutate: resendInvitation, isPending: isResending } = useMutation(
    trpc.user.resendInvitation.mutationOptions({
      onSuccess: () => {
        onResendSuccess?.();
      },
      onError: (error) => {
        // Cas principal : l'invitation était orpheline (un compte existe déjà).
        // Le serveur l'a supprimée et renvoie une 409. On rafraîchit la liste
        // pour faire disparaître la ligne et on remonte le message.
        queryClient.invalidateQueries({
          queryKey: trpc.user.getPendingUsers.queryKey(),
        });
        onResendError?.(error.message);
      },
    }),
  );

  const { mutateAsync: cancelInvitation, isPending: isCancelling } =
    useMutation(
      trpc.user.cancelPendingInvitation.mutationOptions({
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: trpc.user.getPendingUsers.queryKey(),
          });
        },
      }),
    );

  function handleActionChange(value: string) {
    if (value === "resend-invitation") {
      resendInvitation({ pendingUserId });
    } else if (value === "cancel-invitation") {
      cancelModal.open();
    }
  }

  return (
    <>
      <ActionMenu
        ariaLabel={`Actions pour ${pendingUserEmail}`}
        disabled={isResending || isCancelling}
        actions={[
          { value: "resend-invitation", label: "Renvoyer l'invitation" },
          { value: "cancel-invitation", label: "Annuler l'invitation" },
        ]}
        onSelect={handleActionChange}
      />
      <cancelModal.Component
        title="Annuler l'invitation"
        buttons={[
          {
            doClosesModal: true,
            children: "Conserver l'invitation",
            priority: "secondary",
          },
          {
            doClosesModal: false,
            children: "Annuler l'invitation",
            onClick: async () => {
              await cancelInvitation({ pendingUserId });
              cancelModal.close();
            },
          },
        ]}
      >
        <p>
          L&apos;invitation envoyée à <strong>{pendingUserEmail}</strong> sera
          supprimée. Cette personne ne pourra plus créer de compte via cette
          invitation.
        </p>
        <p>
          Cette action est utile si vous avez fait une faute de frappe dans
          l&apos;adresse e-mail ou si vous souhaitez retirer l&apos;accès avant
          que l&apos;invitation ne soit acceptée.
        </p>
      </cancelModal.Component>
    </>
  );
}

function DeactivateUserButton({
  userId,
  onDeactivateUser,
}: {
  userId: string;
  userEmail: string;
  onDeactivateUser: (userId: string) => void;
}) {
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
      <Button priority="secondary" size="small" onClick={() => modal.open()}>
        Désactiver
      </Button>
      <modal.Component
        title="Désactiver l’utilisateur"
        buttons={[
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
          désactivé pour toutes ces équipes.{" "}
        </p>{" "}
        <p>
          {" "}
          Si l&apos;utilisateur est auteur de signalements, ces signalements
          seront transférés à d&apos;autres membres de son équipe.{" "}
        </p>{" "}
        <p>
          {" "}
          Si l&apos;utilisateur a participé à des conversations, les autres
          participants seront avertis de son retrait.{" "}
        </p>{" "}
        <p>
          {" "}
          Cette action est réversible : vous pourrez réactiver un utilisateur si
          nécessaire.{" "}
        </p>
        {process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === "true" && (
          <DeactivationDebugPreview userId={userId} />
        )}
      </modal.Component>
    </>
  );
}

function ReactivateUserButton({
  userId,
  onReactivateUser,
}: {
  userId: string;
  userEmail: string;
  onReactivateUser: (userId: string) => void;
}) {
  const modal = useMemo(
    () =>
      createModal({
        id: `reactivate-user-modal-${userId}`,
        isOpenedByDefault: false,
      }),
    [userId],
  );

  return (
    <>
      <Button priority="secondary" size="small" onClick={() => modal.open()}>
        Réactiver
      </Button>
      <modal.Component
        title="Réactiver l’utilisateur"
        buttons={[
          {
            doClosesModal: false,
            children: "Réactiver le compte",
            onClick: () => {
              onReactivateUser(userId);
              modal.close();
            },
          },
        ]}
      >
        <p>
          Si l&apos;utilisateur faisait partie d&apos;autres équipes, il sera
          réactivé pour toutes ces équipes.
        </p>
        <p>
          Si l&apos;utilisateur était auteur de signalements, ces signalements
          lui seront réattribués.
        </p>
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
        <h2
          style={{
            display: "inline",
            margin: 0,
            fontSize: "inherit",
            fontWeight: "inherit",
            color: "inherit",
          }}
        >
          Aperçu de la désactivation
        </h2>
      </summary>

      <div style={{ marginTop: 12, fontSize: 14 }}>
        {/* Teams section */}
        {data.teams.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Équipes (sera retiré de) :
            </h3>
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
              {data.teams.map((team, i) => (
                <li key={i}>{team}</li>
              ))}
            </ul>
          </div>
        )}

        {data.managedTeams.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Équipes gérées (ne sera plus responsable) :
            </h3>
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

        {/* Summary */}
        {data.scenarios.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Résumé des impacts sur les signalements :
            </h3>
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
                  {revertCount} signalement(s) remis en attente&nbsp;
                  d&apos;affectation
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Detailed scenarios */}
        {data.scenarios.length > 0 && (
          <div>
            <h3 style={{ margin: 0, fontSize: "inherit", fontWeight: "bold" }}>
              Détail par signalement :
            </h3>
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
