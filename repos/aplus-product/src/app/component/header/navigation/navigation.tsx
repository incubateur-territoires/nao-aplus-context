"use client";

import { MainNavigation } from "@codegouvfr/react-dsfr/MainNavigation";
import { usePathname, useSearchParams } from "next/navigation";
import { ROUTE } from "../../../constant/route";
import { isNavItemActive } from "@/utils/nav-active";

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
            pathname.startsWith(ROUTE.ALL_REPORTS) ||
            pathname.startsWith(ROUTE.REPORT),
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
          isActive: isNavItemActive(fullPath, ROUTE.CONTACT),
        },
        ...(isAdmin
          ? [
              {
                text: "Administration",
                isActive: isNavItemActive(fullPath, ROUTE.ADMINISTRATION),
                menuLinks: [
                  {
                    text: "Bandeau",
                    linkProps: { href: ROUTE.ADMIN_BANNER },
                    isActive: isNavItemActive(fullPath, ROUTE.ADMIN_BANNER),
                  },
                  {
                    text: "Signalements anonymisés",
                    linkProps: { href: ROUTE.ANONYMIZED_REPORTS },
                    isActive: isNavItemActive(
                      fullPath,
                      ROUTE.ANONYMIZED_REPORTS,
                    ),
                  },
                  {
                    text: "CRM",
                    linkProps: { href: ROUTE.CONTACTS },
                    isActive: isNavItemActive(fullPath, ROUTE.CONTACTS),
                  },
                ],
              },
            ]
          : []),
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
          isActive: isNavItemActive(fullPath, ROUTE.CONTACT),
        },
      ];

  return <MainNavigation id="menu" items={baseItems} />;
}
