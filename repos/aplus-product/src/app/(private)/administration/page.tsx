import { redirect } from "next/navigation";
import { HydrateClient } from "@/trpc/hydrate-client";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { getCurrentUserRole } from "@/utils/auth-server";
import { trpc, prefetch } from "@/trpc/server";
import { USER_ROLES } from "@/constants/user-roles";
import { BannerForm } from "./components/banner-form/banner-form";

export const metadata = {
  title: "Administration",
};

export default async function AdministrationPage() {
  const role = await getCurrentUserRole();

  if (role !== USER_ROLES.ADMIN) {
    redirect(ROUTE.ALL_REPORTS);
  }

  await prefetch(trpc.banner.getAdmin.queryOptions());

  return (
    <HydrateClient>
      <StartDsfrOnHydration />
      <div className="bg-blue-background min-h-screen">
        <Container>
          <Breadcrumb
            currentPageLabel="Administration"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <h1 className="my-6">Administration</h1>
          <BannerForm />
        </Container>
      </div>
    </HydrateClient>
  );
}
