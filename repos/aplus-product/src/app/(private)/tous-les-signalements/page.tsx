import { Suspense } from "react";
import { RequestList } from "@/app/component/request-list/request-list";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { CreateReport } from "@/app/component/create-report/create-report";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import { ReportMode } from "@/types/report-mode";
import { Spinner } from "@/app/component/spinner/spinner";
import { trpc, prefetch } from "@/trpc/server";
import { getQueryClient } from "@/trpc/hydrate-client";
import { ReportCreatedAlert } from "./report-created-alert";
import { getCurrentUserRole, isCurrentUserManager } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { ExportReports } from "./export-reports/export-reports";
import { StatsBanner } from "./stats-banner/stats-banner";

export const metadata = {
  title: "Tous les signalements",
  description: "Consultez et gérez tous les signalements",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const userRole = await getCurrentUserRole();
  const isSupervisor = userRole === USER_ROLES.SUPERVISOR;
  const isManager = await isCurrentUserManager();
  const canExport =
    userRole === USER_ROLES.SUPERVISOR ||
    userRole === USER_ROLES.ADMIN ||
    isManager;
  const initialQueryInput = {
    page: 1,
    pageSize: 10,
    status: undefined,
    teamIds: undefined,
    search: undefined,
    myReportsOnly: undefined,
    myAnsweredOnly: undefined,
    sortBy: "lastMessage" as const,
    sortOrder: "desc" as const,
  };

  // Prefetch user ET première page des rapports (élimine le "Chargement...")
  const queryClient = getQueryClient();
  // getMyTeamStats (SQL lourd, alimente le 2e onglet non-défaut du bandeau) est
  // volontairement exclu du prefetch bloquant : StatsBanner le charge côté client
  // pour ne pas retarder l'affichage du tableau.
  const [, , createdReports, requestedReports] = await Promise.all([
    prefetch(trpc.user.getCurrentUser.queryOptions()),
    prefetch(trpc.report.getMyReportsStats.queryOptions()),
    queryClient.fetchQuery(
      trpc.report.getMyCreatedReportsTable.queryOptions(initialQueryInput),
    ),
    queryClient.fetchQuery(
      trpc.report.getMyRequestedReportsTable.queryOptions(initialQueryInput),
    ),
  ]);

  const hasNoReports =
    createdReports.pagination.totalCount === 0 &&
    requestedReports.pagination.totalCount === 0;

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Tous les signalements"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <ReportCreatedAlert />

          <h1 className="my-6">Tous les signalements</h1>

          {/* Bandeau stats masqué en production le temps de le finaliser :
              visible uniquement hors production (local, staging). */}
          {process.env.APP_ENVIRONMENT !== "production" && (
            <StatsBanner canExport={canExport} />
          )}

          <Suspense
            fallback={
              <div className="p-4 sm:p-8 md:p-12 lg:p-20 bg-white mt-6 sm:mt-6 relative">
                <div className="flex justify-center items-center py-12">
                  <Spinner />
                </div>
              </div>
            }
          >
            <RequestList mode={ReportMode.CREATED} id="table-created" />
            <RequestList mode={ReportMode.REQUESTED} id="table-requested" />
            {!isSupervisor && <CreateReport hasNoReports={hasNoReports} />}
            {canExport && <ExportReports />}
          </Suspense>
        </Container>
      </div>
    </HydrateClient>
  );
}
