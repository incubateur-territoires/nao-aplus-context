import { HeaderQuickAccessItem } from "@codegouvfr/react-dsfr/Header";
import { headers } from "next/headers";
import { ROUTE } from "../../../constant/route";
import { auth } from "@/lib/auth";
import { LogoutButton } from "./logout-button";
import type { ExtendedUser } from "@/trpc/init";

interface Props {
  id?: string;
}

export async function LoginHeaderItem(props: Props) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const user = session?.user as ExtendedUser | undefined;
  const { id } = props;

  if (user) {
    return (
      <>
        <HeaderQuickAccessItem
          id={id}
          quickAccessItem={{
            iconId: "ri-account-circle-line",
            text: (
              <>
                {user.firstName} {user.lastName}
                <span className="sr-only"> - Accéder à mon profil</span>
              </>
            ),
            linkProps: {
              href: ROUTE.PROFILE,
              title: "Accéder à mon profil",
            },
          }}
        />
        <LogoutButton />
      </>
    );
  }

  return (
    <HeaderQuickAccessItem
      id={id}
      quickAccessItem={{
        iconId: "ri-account-circle-line",
        text: "Se connecter",
        linkProps: {
          href: ROUTE.LOGIN,
        },
      }}
    />
  );
}
