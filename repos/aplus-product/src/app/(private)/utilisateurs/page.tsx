import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { UsersContent } from "./components/users-content/users-content";
import { isAdminOrManager, getCurrentUserRole } from "@/utils/auth-server";
import { trpc, prefetch } from "@/trpc/server";
import { USER_ROLES } from "@/constants/user-roles";
import { Spinner } from "@/app/component/spinner/spinner";

export const metadata = {
  title: "Utilisateurs",
};

export default async function UsersPage() {
  const [hasAccess, role] = await Promise.all([
    isAdminOrManager(),
    getCurrentUserRole(),
  ]);

  if (!hasAccess) {
    redirect(ROUTE.ALL_REPORTS);
  }

  // Prefetch - await pour garantir les données dans le cache avant hydratation
  const prefetchPromises = [
    prefetch(
      trpc.user.getUsers.queryOptions({
        page: 1,
        pageSize: 10,
        search: undefined,
        sortBy: "member",
        sortOrder: "asc",
      }),
    ),
  ];
  if (role === USER_ROLES.ADMIN) {
    prefetchPromises.push(
      prefetch(
        trpc.user.getPendingUsers.queryOptions({
          page: 1,
          pageSize: 10,
        }),
      ),
    );
  }
  await Promise.all(prefetchPromises);

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Utilisateurs"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <h1 className="my-6">Utilisateurs</h1>
          <Suspense
            fallback={
              <div className="p-4 md:p-20 bg-white mt-6 relative">
                <div className="flex justify-center items-center py-12">
                  <Spinner />
                </div>
              </div>
            }
          >
            <UsersContent />
          </Suspense>
        </Container>
      </div>
    </HydrateClient>
  );
}
