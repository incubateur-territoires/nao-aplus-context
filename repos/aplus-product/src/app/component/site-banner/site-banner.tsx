"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import Notice from "@codegouvfr/react-dsfr/Notice";
import DOMPurify from "isomorphic-dompurify";

export function SiteBanner() {
  const trpc = useTRPC();
  const { data: banner } = useQuery(trpc.banner.get.queryOptions());
  const { data: session, isPending: isSessionPending } = useSession();
  const [closed, setClosed] = useState(false);

  const isAuthenticated = Boolean(session?.user);

  if (!banner || closed) {
    return null;
  }

  if (!isAuthenticated && !isSessionPending && !banner.displayOnPublicPages) {
    return null;
  }

  const severity = banner.severity as "info" | "warning" | "alert";

  // RGAA 7.5 : le bandeau apparaît dynamiquement (chargé après le rendu), il
  // doit donc être restitué aux technologies d'assistance via une live region.
  // Une alerte majeure (rouge) interrompt l'utilisateur (assertif : role="alert"),
  // une information ou un avertissement est annoncé sans interrompre (poli :
  // role="status"). Le rôle est porté directement par la div racine du Notice
  // (#fr-notice-…) via son ref, le Notice du DSFR n'exposant pas de prop
  // role/aria-live.
  const role = severity === "alert" ? "alert" : "status";

  return (
    <Notice
      ref={(node) => {
        if (node) {
          node.setAttribute("role", role);
        }
      }}
      title=""
      description={
        <span
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(banner.content),
          }}
        />
      }
      iconDisplayed
      isClosable
      isClosed={closed}
      onClose={() => setClosed(true)}
      severity={severity}
    />
  );
}
