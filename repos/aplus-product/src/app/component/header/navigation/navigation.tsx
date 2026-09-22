"use client";

import { MainNavigation } from "@codegouvfr/react-dsfr/MainNavigation";
import { usePathname, useSearchParams } from "next/navigation";
import { ROUTE } from "../../../constant/route";

interface NavigationClientProps {
  canAccessUsers: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

export function NavigationClient({
  canAccessUsers,
  isAdmin,
  isAuthenticated,
}: NavigationClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Build items array - ensure consistent structure for hydration
  const fullPath = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  const baseItems = isAuthenticated
    ? [
        {
          text: "Signalements",
          linkProps: {
            href: ROUTE.ALL_REPORTS,
          },
          isActive:
            fullPath.includes(ROUTE.ALL_REPORTS) ||
            fullPath.includes(ROUTE.REPORT),
        },
        {
          text: "Équipes",
          linkProps: {
            href: ROUTE.TEAMS,
          },
          isActive: fullPath.includes(ROUTE.TEAMS),
        },
        ...(canAccessUsers
          ? [
              {
                text: "Utilisateurs",
                linkProps: {
                  href: ROUTE.USERS,
                },
                isActive: fullPath.includes(ROUTE.USERS),
              },
            ]
          : []),
        ...(isAdmin
          ? [
              {
                text: "Administration",
                linkProps: {
                  href: ROUTE.ADMINISTRATION,
                },
                isActive: fullPath.includes(ROUTE.ADMINISTRATION),
              },
            ]
          : []),
        {
          text: "Statistiques",
          linkProps: {
            href: ROUTE.STATISTIQUES,
          },
          isActive: fullPath.includes(ROUTE.STATISTIQUES),
        },
        {
          text: "Contact",
          linkProps: {
            href: ROUTE.CONTACT,
          },
          isActive: fullPath.includes(ROUTE.CONTACT),
        },
      ]
    : [
        {
          text: "Accueil",
          linkProps: {
            href: ROUTE.HOME,
          },
          isActive: fullPath === ROUTE.HOME,
        },
        {
          text: "Statistiques",
          linkProps: {
            href: ROUTE.STATISTIQUES,
          },
          isActive: fullPath.includes(ROUTE.STATISTIQUES),
        },
        {
          text: "Contact",
          linkProps: {
            href: ROUTE.CONTACT,
          },
          isActive: fullPath.includes(ROUTE.CONTACT),
        },
      ];

  return <MainNavigation id="menu" items={baseItems} />;
}
