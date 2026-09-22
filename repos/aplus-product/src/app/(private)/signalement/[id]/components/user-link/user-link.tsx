"use client";

import { useSession } from "@/app/component/auth-provider/auth-provider";
import { ROUTE } from "@/app/constant/route";
import { USER_ROLES } from "@/constants/user-roles";
import Link from "next/link";

interface UserLinkProps {
  userId: string;
  firstName: string;
  lastName: string;
  isInactive?: boolean;
  className?: string;
}

export function UserLink({
  userId,
  firstName,
  lastName,
  isInactive,
  className,
}: UserLinkProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === USER_ROLES.ADMIN;

  const displayName = `${firstName} ${lastName}`;
  const inactiveLabel = isInactive ? " (inactif)" : "";

  if (!isAdmin) {
    return (
      <span className={className}>
        {displayName}
        {inactiveLabel}
      </span>
    );
  }

  return (
    <Link
      target="_blank"
      href={`${ROUTE.EDIT_USER}/${userId}`}
      className={`text-blue-primary inline-flex items-center gap-1  ${className ?? ""}`}
    >
      {displayName}
      {inactiveLabel}
      <span className="sr-only"> - nouvelle fenêtre</span>
    </Link>
  );
}
