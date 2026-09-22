"use client";

import { useState, useCallback } from "react";
import { DataTable } from "@/app/component/data-table/data-table";
import { getTeamMembersColumns } from "./team-content-columns/team-content-columns";
import { TeamSettings } from "./team-settings/team-settings";
import { TeamAcceptTypes } from "./team-accept-types/team-accept-types";
import { TeamAdminSettings } from "./team-admin-settings/team-admin-settings";
import { AddMemberForm } from "./add-member-form/add-member-form";
import { useTeamContent } from "./use-team-content/use-team-content";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { USER_ROLES } from "@/constants/user-roles";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { useFocusOnVisible } from "@/app/hooks/use-focus-on-visible";

export function TeamContent({
  teamId,
  isAdmin,
}: {
  teamId: string;
  isAdmin: boolean;
}) {
  const {
    isManager,
    isOperatorGroup,
    data,
    handleRemoveUser,
    team,
    currentUserId,
  } = useTeamContent({ teamId });

  const currentUser = useSession();
  const isSupervisor = currentUser.data?.user?.role === USER_ROLES.SUPERVISOR;
  const [showResendAlert, setShowResendAlert] = useState(false);
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [addedEmails, setAddedEmails] = useState<string[]>([]);
  const [resendErrorMessage, setResendErrorMessage] = useState<string | null>(
    null,
  );

  const removeAlertRef = useFocusOnVisible(showRemoveAlert);
  const addAlertRef = useFocusOnVisible(showAddAlert);
  const resendAlertRef = useFocusOnVisible(showResendAlert);
  const resendErrorRef = useFocusOnVisible(!!resendErrorMessage);

  const handleResendSuccess = useCallback(() => {
    setResendErrorMessage(null);
    setShowResendAlert(true);
  }, []);

  const handleResendError = useCallback((message: string) => {
    setShowResendAlert(false);
    setResendErrorMessage(message);
  }, []);

  const handleAddSuccess = useCallback((emails: string[]) => {
    setAddedEmails(emails);
    setShowAddAlert(true);
  }, []);

  async function handleRequestRemoveUser(userId: string) {
    const success = await handleRemoveUser(userId);
    if (success) {
      setShowRemoveAlert(true);
    }
  }

  // Count total managers (confirmed + pending)
  const managersCount =
    (team?.managers?.length ?? 0) + (team?.pendingManagers?.length ?? 0);

  const columns = getTeamMembersColumns(
    handleRequestRemoveUser,
    isManager,
    isAdmin,
    teamId,
    currentUserId,
    managersCount,
    isSupervisor,
    handleResendSuccess,
    handleResendError,
  );

  return (
    <>
      {showRemoveAlert && (
        <div className="mb-6" ref={removeAlertRef} tabIndex={-1}>
          <Alert
            severity="success"
            role="status"
            title="Le membre a bien été retiré de l'équipe."
            closable
            onClose={() => setShowRemoveAlert(false)}
          />
        </div>
      )}
      {showAddAlert && (
        <div className="mb-6" ref={addAlertRef} tabIndex={-1}>
          <Alert
            severity="success"
            role="status"
            title={
              addedEmails.length > 1
                ? "Les membres ont bien été ajoutés à l'équipe."
                : "Le membre a bien été ajouté à l'équipe."
            }
            closable
            onClose={() => setShowAddAlert(false)}
            description={
              <>
                {addedEmails.length > 1
                  ? "Adresses e-mail des nouveaux membres :"
                  : "Adresse e-mail du nouveau membre :"}
                <br />
                {addedEmails.map((email, i) => (
                  <span key={email}>
                    {email}
                    {i < addedEmails.length - 1 && <br />}
                  </span>
                ))}
              </>
            }
          />
        </div>
      )}
      {resendErrorMessage && (
        <div className="mb-6" ref={resendErrorRef} tabIndex={-1}>
          <Alert
            severity="info"
            role="status"
            title="Invitation non renvoyée"
            closable
            onClose={() => setResendErrorMessage(null)}
            description={resendErrorMessage}
          />
        </div>
      )}
      {showResendAlert && (
        <div className="mb-6" ref={resendAlertRef} tabIndex={-1}>
          <Alert
            severity="success"
            role="status"
            title="L'invitation a bien été renvoyée."
            closable
            onClose={() => setShowResendAlert(false)}
            description={
              <>
                Si l&apos;utilisateur n&apos;a pas reçu d&apos;e-mail
                d&apos;invitation sous une heure, son filtre anti-spam bloque
                peut-être la réception de nos messages. Dans ce cas, vous pouvez{" "}
                <a
                  href="https://docs.aplus.beta.gouv.fr/contacter-lequipe"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  contacter notre support
                  <span className="sr-only"> - nouvelle fenêtre</span>
                </a>
                .
              </>
            }
          />
        </div>
      )}
      <h1 className="mb-8">{team?.name}</h1>
      <div className="p-4 md:p-20 bg-white relative">
        <h2 className="text-[32px] leading-[40px] font-bold text-[#161616]">
          Membres
        </h2>
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={data}
            defaultSorting={[{ id: "member", desc: false }]}
            emptyMessage="Cette équipe n'a pas de membre."
            pageSize={10}
          />
        </div>
        {(isManager || isAdmin || isSupervisor) && (
          <div className="mt-12">
            <AddMemberForm
              isOperatorGroup={isOperatorGroup}
              teamId={teamId}
              hasMembers={data.length > 0}
              onAddSuccess={handleAddSuccess}
            />
          </div>
        )}
      </div>
      <TeamSettings teamId={teamId} />
      <TeamAcceptTypes teamId={teamId} />
      <TeamAdminSettings teamId={teamId} />
    </>
  );
}
