"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { useTRPC } from "@/trpc/client";
import { USER_ROLES } from "@/constants/user-roles";
import { ROUTE } from "@/app/constant/route";
import { NoTeamAlert } from "./no-team-alert";

const ALLOWED_ROUTES: ReadonlySet<string> = new Set([
  ROUTE.HOME,
  ROUTE.LOGIN,
  ROUTE.FORGOT_PASSWORD,
  ROUTE.NEW_PASSWORD,
  ROUTE.PROFILE,
  ROUTE.CONTACT,
  ROUTE.CGU,
  ROUTE.MENTIONS_LEGALES,
  ROUTE.DONNEES_PERSONNELLES,
  ROUTE.ACCESSIBILITE,
  ROUTE.PLAN_DU_SITE,
  ROUTE.STATISTIQUES,
  ROUTE.COMPLETE_PROFILE,
  ROUTE.SETUP_2FA,
  ROUTE.VERIFY_2FA,
  ROUTE.FINISH_REGISTRATION,
]);

interface NoTeamGuardProps {
  children: React.ReactNode;
}

export function NoTeamGuard({ children }: NoTeamGuardProps) {
  const { data: session, isPending: isSessionPending } = useSession();
  const trpc = useTRPC();
  const pathname = usePathname();

  const isAuthenticated = !!session?.user;
  const role = session?.user?.role;
  const isPrivilegedRole =
    role === USER_ROLES.ADMIN || role === USER_ROLES.SUPERVISOR;

  const { data: currentUser, isPending: isUserPending } = useQuery({
    ...trpc.user.getCurrentUser.queryOptions(),
    enabled: isAuthenticated && !isPrivilegedRole,
  });

  if (!isAuthenticated || isPrivilegedRole) {
    return <>{children}</>;
  }

  if (ALLOWED_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  if (isSessionPending || isUserPending || !currentUser) {
    return <>{children}</>;
  }

  if (currentUser.teams.length === 0) {
    return <NoTeamAlert />;
  }

  return <>{children}</>;
}
