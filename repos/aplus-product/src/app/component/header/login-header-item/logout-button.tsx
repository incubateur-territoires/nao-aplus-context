"use client";

import Button from "@codegouvfr/react-dsfr/Button";
import { signOut } from "@/lib/auth-client";
import { ROUTE } from "../../../constant/route";
import { useAnalytics } from "@/app/hooks/use-analytics";

export function LogoutButton() {
  const { track } = useAnalytics();

  return (
    <Button
      priority="tertiary"
      onClick={async () => {
        track("auth_sign_out", {});
        await signOut({
          fetchOptions: {
            onSuccess: () => {
              window.location.href = ROUTE.LOGIN;
            },
          },
        });
      }}
    >
      Se déconnecter
    </Button>
  );
}
