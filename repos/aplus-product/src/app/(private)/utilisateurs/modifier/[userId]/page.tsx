import type { Metadata } from "next";
import { getQueryClient, HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import { EditUserContent } from "./edit-user-content/edit-user-content";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { redirect } from "next/navigation";
import { trpc, prefetch } from "@/trpc/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const queryClient = getQueryClient();
  try {
    const user = await queryClient.fetchQuery(
      trpc.user.getFullUserById.queryOptions(userId),
    );
    return {
      title: user ? `${user.firstName} ${user.lastName}` : "Utilisateur",
    };
  } catch {
    return { title: "Utilisateur" };
  }
}

interface EditUserPageProps {
  params: Promise<{ userId: string }>;
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const { userId } = await params;
  const queryClient = getQueryClient();

  // Prefetch en parallèle - await pour garantir les données dans le cache avant hydratation
  let user;
  try {
    const [fetchedUser] = await Promise.all([
      queryClient.fetchQuery(trpc.user.getFullUserById.queryOptions(userId)),
      prefetch(trpc.user.getCurrentUser.queryOptions()),
      prefetch(trpc.team.getTeams.queryOptions()),
      // Activité de l'utilisateur : le résumé « En bref » et les compteurs de
      // filtres ne dépendent que du userId, on peut donc les prefetch côté
      // serveur (la table getUserEvents reste client-side car paginée/filtrée).
      prefetch(trpc.analytics.getUserActivitySummary.queryOptions({ userId })),
      prefetch(trpc.analytics.getUserEventCounts.queryOptions({ userId })),
    ]);
    user = fetchedUser;
  } catch {
    // User not found or not authorized (e.g., deactivated user with no teams)
    redirect(ROUTE.USERS);
  }

  if (!user) {
    redirect(ROUTE.USERS);
  }

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel={`${user.firstName} ${user.lastName}`}
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[
              {
                label: "Utilisateurs",
                linkProps: { href: ROUTE.USERS },
              },
            ]}
          />
          <EditUserContent userId={userId} />
        </Container>
      </div>
    </HydrateClient>
  );
}
