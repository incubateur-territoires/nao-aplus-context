"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { useTRPC } from "@/trpc/client";
import { ROUTE } from "@/app/constant/route";

// Les trois premiers parcours portent leur propre étape obligatoire, qui passe
// avant celle-ci. ROUTE.CGU est le texte que la barrière demande d'attester :
// la dévier rendrait la page d'acceptation incompréhensible.
const DEFERRED_ROUTES: ReadonlySet<string> = new Set([
  ROUTE.CGU_ACCEPTANCE,
  ROUTE.COMPLETE_PROFILE,
  ROUTE.SETUP_2FA,
  ROUTE.VERIFY_2FA,
  ROUTE.CGU,
]);

interface CguAcceptanceGuardProps {
  children: React.ReactNode;
}

export function CguAcceptanceGuard({ children }: CguAcceptanceGuardProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const trpc = useTRPC();

  const isAuthenticated = !!session?.user;

  // Pas de contrôle d'impersonation ici : mustAcceptCurrentCgu le fait côté
  // serveur, un doublon client serait une seconde source de vérité.
  const { data: cguStatus } = useQuery({
    ...trpc.user.getCguStatus.queryOptions(),
    enabled: isAuthenticated,
  });

  // isAuthenticated reste dans la condition : react-query garde la dernière
  // valeur quand la requête se désactive, et une session perdue bouclerait.
  const mustRedirect =
    isAuthenticated &&
    cguStatus?.mustAccept === true &&
    !DEFERRED_ROUTES.has(pathname);

  useEffect(() => {
    if (!mustRedirect) {
      return;
    }
    const returnTo = pathname + window.location.search;
    router.replace(
      `${ROUTE.CGU_ACCEPTANCE}?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }, [mustRedirect, pathname, router]);

  if (mustRedirect) {
    return null;
  }

  return <>{children}</>;
}
