"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { USER_ROLES } from "@/constants/user-roles";
import { ROUTE } from "@/app/constant/route";

interface TwoFactorGuardProps {
  children: React.ReactNode;
}

export function TwoFactorGuard({ children }: TwoFactorGuardProps) {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) return;

    const isAdmin = session.user.role === USER_ROLES.ADMIN;
    const hasTwoFactor = session.user.twoFactorEnabled === true;
    const isSetupPage = pathname === ROUTE.SETUP_2FA;

    if (isAdmin && !hasTwoFactor && !isSetupPage) {
      router.replace(ROUTE.SETUP_2FA);
    }
  }, [session, isPending, pathname, router]);

  return <>{children}</>;
}
