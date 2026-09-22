"use client";

import { signIn } from "@/lib/auth-client";
import { ProConnectButton } from "@codegouvfr/react-dsfr/ProConnectButton";

export function ProConnectSignIn() {
  function handleProConnectSignIn() {
    signIn.social({
      provider: "proconnect",
      callbackURL: "/connexion/redirect",
    });
  }

  return <ProConnectButton onClick={handleProConnectSignIn} />;
}
