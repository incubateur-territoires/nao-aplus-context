"use client";

import { Button } from "@codegouvfr/react-dsfr/Button";
import { TeamsTable } from "../teams-table/teams-table";
import { ROUTE } from "@/app/constant/route";

interface AdminContentProps {
  showCreateButton?: boolean;
}

export function AdminContent({ showCreateButton = true }: AdminContentProps) {
  return (
    <div className="p-4 md:p-20 bg-white mt-6 relative">
      <TeamsTable />
      {showCreateButton && (
        <div className="flex justify-end mt-8">
          <Button
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
  );
}
