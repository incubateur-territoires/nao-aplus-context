import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Container } from "@/app/component/container/container";
import { RequestForm } from "@/app/component/request-form/request-form";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { ROUTE } from "@/app/constant/route";
import { RequestFormStepper } from "@/app/component/request-form/request-form-stepper/request-form-stepper";
import { getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";

// metadats
export const metadata = {
  title: "Nouveau signalement",
  description: "Nouveau signalement",
};

export default async function Page() {
  const userRole = await getCurrentUserRole();
  if (userRole === USER_ROLES.SUPERVISOR) {
    redirect(ROUTE.HOME);
  }
  return (
    <div className="bg-blue-background">
      <Container>
        <Breadcrumb
          currentPageLabel="Nouveau signalement"
          homeLinkProps={{
            href: ROUTE.HOME,
          }}
          segments={[]}
        />
        <h1>Nouveau signalement</h1>
        <div className="p-4 md:p-20 bg-white mt-8 relative">
          <Suspense fallback={<div className="h-12" />}>
            <RequestFormStepper />
          </Suspense>
          <RequestForm />
        </div>
      </Container>
    </div>
  );
}
