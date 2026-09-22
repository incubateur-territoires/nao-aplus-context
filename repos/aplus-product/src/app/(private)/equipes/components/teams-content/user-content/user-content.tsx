"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Pagination } from "@/app/component/pagination/pagination";
import { useTRPC } from "@/trpc/client";
import { TeamCard } from "../team-card/team-card";
import { useSession } from "@/lib/auth-client";
import { USER_ROLES } from "@/constants/user-roles";
import { ROUTE } from "@/app/constant/route";
import Button from "@codegouvfr/react-dsfr/Button";

const ITEMS_PER_PAGE = 10;

export function UserContent() {
  const trpc = useTRPC();
  const [currentPage, setCurrentPage] = useState(1);
  const { data: teams } = useQuery({
    ...trpc.team.getMyTeams.queryOptions({
      page: currentPage,
      pageSize: ITEMS_PER_PAGE,
      sortBy: "name",
      sortOrder: "asc",
    }),
    placeholderData: keepPreviousData,
  });
  const { data: session } = useSession();
  const currentUser = session?.user;
  const isManagerOfAnyTeam =
    teams?.items.some((team) =>
      team.managers?.some((manager) => manager.id === currentUser?.id),
    ) ?? false;

  const isAdmin = currentUser?.role === USER_ROLES.ADMIN;
  const canCreateTeam = isManagerOfAnyTeam || isAdmin;
  const totalPages = teams?.totalPages ?? 0;

  return (
    <div className="p-4 md:p-20 bg-white mt-8 relative">
      <div className="flex justify-between items-center">
        <h2>Vos équipes</h2>
      </div>

      <div className="flex flex-col gap-10 mt-10">
        {teams?.items.map((team) => {
          const isManager =
            team.managers?.some((manager) => manager.id === currentUser?.id) ??
            false;
          const canEdit = isManager || isAdmin;
          return <TeamCard key={team.id} team={team} canEdit={canEdit} />;
        })}
        {canCreateTeam && (
          <div className="flex justify-end">
            <Button
              size="large"
              iconId="ri-add-line"
              linkProps={{
                href: ROUTE.CREATE_TEAM,
              }}
            >
              Créer une équipe
            </Button>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={totalPages}
            defaultPage={currentPage}
            getPageLinkProps={(pageNumber) => ({
              href: "#",
              "aria-label": `Page ${pageNumber}`,
              onClick: (e: React.MouseEvent) => {
                e.preventDefault();
                setCurrentPage(pageNumber);
              },
            })}
            showFirstLast
          />
        </div>
      )}
    </div>
  );
}
