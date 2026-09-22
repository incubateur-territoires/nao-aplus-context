"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { ROUTE } from "@/app/constant/route";

interface ProfileCompletionGuardProps {
  children: React.ReactNode;
}

export function ProfileCompletionGuard({
  children,
}: ProfileCompletionGuardProps) {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const isCompletePage = pathname === ROUTE.COMPLETE_PROFILE;
  const hasFirstName = !!session?.user?.firstName?.trim();
  const hasLastName = !!session?.user?.lastName?.trim();
  const needsCompletion =
    !isPending && !!session?.user && (!hasFirstName || !hasLastName);

  useEffect(() => {
    if (needsCompletion && !isCompletePage) {
      // Conserver la page demandée pour y revenir après complétion du profil
      // (ex: lien d'email vers un signalement précis).
      const returnTo = pathname + window.location.search;
      router.replace(
        `${ROUTE.COMPLETE_PROFILE}?returnTo=${encodeURIComponent(returnTo)}`,
      );
    }
  }, [needsCompletion, isCompletePage, router, pathname]);

  if (needsCompletion && !isCompletePage) {
    return null;
  }

  return <>{children}</>;
}
