import type { Metadata } from "next";
import { ROUTE } from "@/app/constant/route";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { Container } from "@/app/component/container/container";
import { getQueryClient, HydrateClient } from "@/trpc/hydrate-client";
import { TeamContent } from "./components/team-content/team-content";
import { trackServerEvent } from "@/lib/analytics/server-analytics";
import { trpc, prefetch } from "@/trpc/server";
import { getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { forbidden } from "next/navigation";
import { TRPCError } from "@trpc/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const queryClient = getQueryClient();
  const team = await queryClient
    .fetchQuery(trpc.team.getTeamById.queryOptions(id))
    .catch(() => null);
  return {
    title: team ? `Équipe ${team.name}` : "Équipe",
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();

  let team;
  try {
    // Prefetch all queries in parallel - await pour garantir les données dans le cache avant hydratation
    [team] = await Promise.all([
      // Fetch pour le breadcrumb (on a besoin du nom) - retourne la valeur
      queryClient.fetchQuery(trpc.team.getTeamById.queryOptions(id)),
      // Prefetch les autres queries
      prefetch(trpc.team.getTeamMembersActivity.queryOptions(id)),
      // Pour TeamAdminSettings (admins uniquement, mais prefetch est cheap)
      prefetch(trpc.area.getAreas.queryOptions()),
      prefetch(trpc.organization.getOrganizations.queryOptions()),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      forbidden();
    }
    throw error;
  }

  const currentUserRole = await getCurrentUserRole();
  const isAdmin = currentUserRole === USER_ROLES.ADMIN;

  // Track team view (fire and forget)
  void trackServerEvent("team_viewed", {
    teamId: id,
  });

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel={`Équipe ${team?.name ?? ""}`}
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[
              {
                label: "Équipes",
                linkProps: {
                  href: ROUTE.TEAMS,
                },
              },
            ]}
          />
          <TeamContent teamId={id} isAdmin={isAdmin} />
        </Container>
      </div>
    </HydrateClient>
  );
}
