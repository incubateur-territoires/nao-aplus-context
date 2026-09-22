import type { ColumnDef } from "@tanstack/react-table";
import Button from "@codegouvfr/react-dsfr/Button";
import { formatDate } from "@/app/component/reports-table/reports-table-utils/reports-table.utils";
import { USER_ROLES } from "@/constants/user-roles";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { TeamRole } from "@/types/team";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import type { ActivityMetrics } from "../team-content-utils/team-content.utils";
import { EditUserButton } from "@/app/(private)/utilisateurs/components/users-content/users-columns/edit-user-button";
import {
  ActionMenu,
  type ActionMenuHandle,
} from "@/app/component/action-menu/action-menu";

export interface TeamMemberRow {
  id: string;
  fullName: string;
  lastName: string;
  email: string;
  roleLabel: string;
  profession?: string | null;
  activityLabels: string[];
  activityMetrics?: ActivityMetrics;
  lastActivity: Date | null;
  isPending: boolean;
  isInactive: boolean;
}

export function getTeamMembersColumns(
  onRemoveUser: (userId: string) => void,
  isManager: boolean = false,
  isAdmin: boolean = false,
  teamId: string = "",
  currentUserId: string | undefined = undefined,
  managersCount: number = 0,
  isSupervisor: boolean = false,
  onResendSuccess?: () => void,
  onResendError?: (message: string) => void,
): ColumnDef<TeamMemberRow>[] {
  const columns: ColumnDef<TeamMemberRow>[] = [];

  if (isAdmin) {
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
      accessorFn: (row) => row.lastName,
      meta: { sortType: "alpha" },
      cell: ({ row }) => (
        <div>
          <div className="font-bold">{row.original.fullName}</div>
          <div className="text-xs mt-1">{row.original.email}</div>
        </div>
      ),
      enableSorting: true,
    },
    {
      id: "role",
      header: () => (
        <div>
          <div>Rôle</div>
          <div className="text-xs font-normal text-[#3A3A3A] mt-1">
            Profession
          </div>
        </div>
      ),
      accessorFn: (row) => row.roleLabel,
      meta: { sortType: "role" },
      sortingFn: (rowA, rowB) => {
        const ROLE_PRIORITY: Record<string, number> = {
          [USER_ROLES.ADMIN]: 0,
          [USER_ROLES.SUPERVISOR]: 1,
          [TeamRole.MANAGER]: 2,
        };
        const a = ROLE_PRIORITY[rowA.original.roleLabel] ?? 3;
        const b = ROLE_PRIORITY[rowB.original.roleLabel] ?? 3;
        return a - b;
      },
      cell: ({ row }) => {
        const { roleLabel, isPending } = row.original;

        function getRoleBadges() {
          const badges: React.ReactNode[] = [];

          if (row.original.isInactive) {
            badges.push(
              <Badge key="inactive" severity="error" noIcon>
                Compte inactif
              </Badge>,
            );
          }

          if (isPending) {
            badges.push(
              <Badge
                key="pending"
                severity="warning"
                noIcon
                className="whitespace-nowrap"
              >
                En attente
              </Badge>,
            );
          }

          switch (roleLabel) {
            case USER_ROLES.ADMIN:
              badges.push(
                <Badge key="admin" severity="new" noIcon>
                  {USER_ROLES.ADMIN}
                </Badge>,
              );
              break;
            case USER_ROLES.SUPERVISOR:
              badges.push(
                <Badge key="supervisor" severity="new" noIcon>
                  SUPERVISEUR
                </Badge>,
              );
              break;
            case TeamRole.MANAGER:
              badges.push(
                <Badge key="manager" severity="info" noIcon>
                  {TeamRole.MANAGER}
                </Badge>,
              );
              break;
          }

          if (badges.length === 0) return null;
          if (badges.length === 1) return badges[0];

          return <div className="flex flex-col gap-2">{badges}</div>;
        }

        return (
          <div>
            {getRoleBadges()}
            {row.original.profession && (
              <div className="text-xs mt-1">{row.original.profession}</div>
            )}
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "activity",
      header: "Activité",
      accessorFn: (row) => row.activityLabels.join(", "),
      cell: ({ row }) => {
        const labels = row.original.activityLabels;
        if (labels.length === 0) {
          return <span className="text-xs text-[#666666]">-</span>;
        }
        return (
          <div className="flex flex-col">
            {labels.map((label, index) => (
              <span key={index} className="text-xs">
                {label}
              </span>
            ))}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "last-activity",
      header: "Dernière activité",
      accessorFn: (row) => row.lastActivity,
      meta: { sortType: "date" },
      cell: ({ row }) => {
        if (row.original.isPending) {
          return (
            <Badge severity="warning" noIcon className="whitespace-nowrap">
              CGU non acceptées
            </Badge>
          );
        }

        return (
          <span className="text-xs">
            {row.original.lastActivity
              ? formatDate(row.original.lastActivity)
              : "-"}
          </span>
        );
      },
      enableSorting: true,
    },
  );

  if (isManager || isAdmin || isSupervisor) {
    columns.push({
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        return (
          <MemberActionCell
            member={row.original}
            teamId={teamId}
            currentUserId={currentUserId}
            managersCount={managersCount}
            isManager={isManager}
            onRemoveUser={onRemoveUser}
            onResendSuccess={onResendSuccess}
            onResendError={onResendError}
          />
        );
      },
      enableSorting: false,
    });
  }

  return columns;
}

function MemberActionCell({
  member,
  teamId,
  currentUserId,
  managersCount,
  isManager,
  onRemoveUser,
  onResendSuccess,
  onResendError,
}: {
  member: TeamMemberRow;
  teamId: string;
  currentUserId: string | undefined;
  managersCount: number;
  isManager: boolean;
  onRemoveUser: (userId: string) => void;
  onResendSuccess?: () => void;
  onResendError?: (message: string) => void;
}) {
  const [selectedAction, setSelectedAction] = useState("");
  const menuRef = useRef<ActionMenuHandle>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutateAsync: addManager } = useMutation(
    trpc.team.addManager.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.team.getTeamById.queryKey(teamId),
        });
      },
    }),
  );

  const { mutateAsync: removeManager } = useMutation(
    trpc.team.removeManager.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.team.getTeamById.queryKey(teamId),
        });
      },
    }),
  );

  const { mutate: resendInvitation } = useMutation(
    trpc.user.resendInvitation.mutationOptions({
      onSuccess: () => {
        setSelectedAction("");
        onResendSuccess?.();
      },
      onError: (error) => {
        setSelectedAction("");
        // L'invitation était orpheline (un compte existe déjà) : le serveur l'a
        // supprimée et renvoie une 409. On rafraîchit l'équipe pour faire
        // disparaître la ligne et on remonte le message.
        queryClient.invalidateQueries({
          queryKey: trpc.team.getTeamById.queryKey(teamId),
        });
        onResendError?.(error.message);
      },
    }),
  );

  const { roleLabel, id: memberId } = member;

  // Cannot manage admins
  if (roleLabel === USER_ROLES.ADMIN) return null;

  const isMemberManager = roleLabel === TeamRole.MANAGER;
  const isLastManager = isMemberManager && managersCount <= 1;

  // Last manager cannot be removed - show message instead (check this BEFORE the self-management check)
  if (isLastManager) {
    return (
      <span className="text-xs text-[#3A3A3A]">
        Unique responsable
        <br />
        ne peut être supprimé
      </span>
    );
  }

  // Cannot manage: managers trying to manage themselves
  const isCurrentUser = memberId === currentUserId;
  if (isManager && isCurrentUser) return null;

  async function handleActionChange(value: string) {
    if (value === "add-manager") {
      await addManager({ teamId, memberId, isPending: member.isPending });
    } else if (value === "remove-manager") {
      await removeManager({ teamId, memberId, isPending: member.isPending });
    } else if (value === "resend-invitation") {
      resendInvitation({ pendingUserId: memberId });
    } else if (value === "remove-user") {
      setSelectedAction(value);
    }
  }

  const actions: { value: string; label: string }[] = [];
  if (!isMemberManager) {
    actions.push({ value: "add-manager", label: "Définir comme responsable" });
  }
  if (isMemberManager && managersCount > 1) {
    actions.push({
      value: "remove-manager",
      label: "Enlever le rôle de responsable",
    });
  }
  if (member.isPending) {
    actions.push({
      value: "resend-invitation",
      label: "Renvoyer l'invitation",
    });
  }
  actions.push({ value: "remove-user", label: "Retirer de l'équipe" });

  return (
    <div className="flex items-center gap-2">
      <ActionMenu
        ref={menuRef}
        ariaLabel={`Actions pour ${member.fullName}`}
        actions={actions}
        onSelect={handleActionChange}
      />
      <RemoveUserModalTrigger
        userEmail={member.email}
        userId={member.id}
        teamId={teamId}
        onRemoveUser={onRemoveUser}
        selectedAction={selectedAction}
        setSelectedAction={setSelectedAction}
        onClose={() => menuRef.current?.focusTrigger()}
      />
    </div>
  );
}

function RemoveUserModalTrigger({
  userEmail,
  userId,
  teamId,
  onRemoveUser,
  selectedAction,
  setSelectedAction,
  onClose,
}: {
  userEmail: string;
  userId: string;
  teamId: string;
  onRemoveUser: (userId: string) => void;
  selectedAction: string;
  setSelectedAction: (value: string) => void;
  onClose?: () => void;
}) {
  const modal = useMemo(
    () =>
      createModal({
        id: `remove-user-action-modal-${userId}`,
        isOpenedByDefault: false,
      }),
    [userId],
  );

  const isModalOpen = useIsModalOpen(modal);

  // Open modal when "remove-user" is selected
  useEffect(() => {
    if (selectedAction === "remove-user") {
      modal.open();
      setSelectedAction("");
    }
  }, [selectedAction, modal, setSelectedAction]);

  return (
    <modal.Component
      title="Confirmer le retrait d'un membre"
      className="p-0 mb-0"
      buttons={[
        {
          doClosesModal: true,
          children: "Annuler",
          onClick: () => onClose?.(),
        },
        {
          doClosesModal: false,
          children: "Retirer de l'équipe",
          onClick: async () => {
            onRemoveUser(userId);
            modal.close();
            onClose?.();
          },
        },
      ]}
    >
      <p>
        <strong>{userEmail}</strong> n&apos;aura plus accès aux signalements
        liés à cette équipe.
      </p>
      {isModalOpen && <RemovalDebugPreview userId={userId} teamId={teamId} />}
    </modal.Component>
  );
}

export function RemoveUserModal({
  userEmail,
  onRemoveUser,
  userId,
  teamId,
}: {
  userEmail: string;
  onRemoveUser: (userId: string) => void;
  userId: string;
  teamId: string;
}) {
  const modal = useMemo(
    () =>
      createModal({
        id: `remove-user-modal-${userId}`,
        isOpenedByDefault: false,
      }),
    [userId],
  );
  const isModalOpen = useIsModalOpen(modal);

  return (
    <>
      <Button
        priority="secondary"
        size="small"
        onClick={() => modal.open()}
        className="whitespace-nowrap"
      >
        Retirer
      </Button>
      <modal.Component
        title="Confirmer le retrait d'un membre"
        className="p-0 mb-0 m"
        buttons={[
          {
            doClosesModal: true,
            children: "Annuler",
          },
          {
            doClosesModal: false,
            children: "Retirer de l'équipe",
            onClick: async () => {
              onRemoveUser(userId);
              modal.close();
            },
          },
        ]}
      >
        <p>
          <strong>{userEmail}</strong> n&apos;aura plus accès aux signalements
          liés à cette équipe.
        </p>
        {isModalOpen && <RemovalDebugPreview userId={userId} teamId={teamId} />}
      </modal.Component>
    </>
  );
}

const deactivateUserModal = createModal({
  id: "deactivate-user-modal",
  isOpenedByDefault: false,
});

export function DeactivateUserModal({
  userEmail,
  onDeactivateUser,
  userId,
}: {
  userEmail: string;
  onDeactivateUser: (userId: string) => void;
  userId: string;
}) {
  return (
    <>
      <Button
        priority="tertiary no outline"
        size="small"
        onClick={() => deactivateUserModal.open()}
      >
        Désactiver le compte
      </Button>
      <deactivateUserModal.Component
        title="Confirmer la désactivation du compte"
        className="p-0 mb-0 m"
        buttons={[
          {
            doClosesModal: true,
            children: "Annuler",
          },
          {
            doClosesModal: false,
            children: "Désactiver le compte",
            onClick: async () => {
              onDeactivateUser(userId);
              deactivateUserModal.close();
            },
          },
        ]}
      >
        <p>
          <strong>{userEmail}</strong> ne pourra plus se connecter à
          l&apos;application. Cette action est réversible.
        </p>
      </deactivateUserModal.Component>
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

export function RemovalDebugPreview({
  userId,
  teamId,
}: {
  userId: string;
  teamId: string;
}) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.team.previewRemoveFromTeam.queryOptions({ userId, teamId }),
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
          Aperçu du retrait de l&apos;équipe
        </h2>
      </summary>

      <div style={{ marginTop: 12, fontSize: 14 }}>
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
                  {revertCount} signalement(s) remis en attente
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
            Aucun signalement actif affecté par ce retrait.
          </div>
        )}
      </div>
    </details>
  );
}
