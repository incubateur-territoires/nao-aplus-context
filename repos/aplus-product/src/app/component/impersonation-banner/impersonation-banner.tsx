"use client";

import { useSession, admin } from "@/lib/auth-client";
import Button from "@codegouvfr/react-dsfr/Button";
import { ROUTE } from "@/app/constant/route";

export function ImpersonationBanner() {
  const { data: session } = useSession();

  if (!session?.impersonatedBy) {
    return null;
  }

  async function handleStopImpersonation() {
    const impersonatedUserId = session?.user?.id;
    await admin.stopImpersonating();
    window.location.href = impersonatedUserId
      ? `${ROUTE.EDIT_USER}/${impersonatedUserId}`
      : "/";
  }

  const userName = session.user
    ? `${session.user.firstName} ${session.user.lastName}`
    : "cet utilisateur";

  return (
    <div
      className="flex items-center justify-center gap-4 px-4 py-2"
      style={{
        backgroundColor: "#e1000f",
        color: "white",
      }}
    >
      <span
        className="fr-icon-eye-line"
        aria-hidden="true"
        style={{ color: "white" }}
      />
      <span>
        Mode aperçu : vous voyez l&apos;application comme{" "}
        <strong>{userName}</strong>
      </span>
      <Button
        priority="tertiary no outline"
        size="small"
        onClick={handleStopImpersonation}
        style={{
          color: "white",
          borderColor: "white",
          backgroundColor: "transparent",
        }}
        className="hover:bg-white/20"
      >
        Terminer l&apos;aperçu
      </Button>
    </div>
  );
}
