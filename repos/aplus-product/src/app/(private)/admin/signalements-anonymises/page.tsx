import { redirect } from "next/navigation";
import { HydrateClient, getQueryClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { trpc, prefetch } from "@/trpc/server";
import { USER_ROLES } from "@/constants/user-roles";
import { parseAnonymizedReportSearch } from "@/utils/anonymized-report";
import { AnonymizedReports } from "./components/anonymized-reports/anonymized-reports";

export const metadata = {
  title: "Signalements anonymisés",
};

interface AnonymizedReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnonymizedReportsPage({
  searchParams,
}: AnonymizedReportsPageProps) {
  const role = await getCurrentUserRole();

  if (role !== USER_ROLES.ADMIN) {
    redirect(ROUTE.ALL_REPORTS);
  }

  const search = parseAnonymizedReportSearch(await searchParams);
  const { id, ...listInput } = search;
  const queryClient = getQueryClient();
  const [list, operators] = await Promise.all([
    queryClient.fetchQuery(trpc.anonymizedReport.list.queryOptions(listInput)),
    queryClient.fetchQuery(trpc.anonymizedReport.operators.queryOptions()),
  ]);
  const selectedId = id ?? list.items[0]?.id;
  if (selectedId) {
    await prefetch(
      trpc.anonymizedReport.getById.queryOptions({ id: selectedId }),
    );
  }

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Signalements anonymisés"
            homeLinkProps={{ href: ROUTE.HOME }}
            segments={[
              {
                label: "Administration",
                linkProps: { href: ROUTE.ADMINISTRATION },
              },
            ]}
          />
          <h1 className="my-6">Signalements anonymisés</h1>
          <AnonymizedReports search={search} operators={operators} />
        </Container>
      </div>
    </HydrateClient>
  );
}
