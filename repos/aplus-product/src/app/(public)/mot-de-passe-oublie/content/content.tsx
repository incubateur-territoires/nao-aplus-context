/* Components */
import { Container } from "@/app/component/container/container";
import { ResetPasswordForm } from "./reset-password/reset-password";
import { StartDsfrOnHydration } from "../../../../dsfr-bootstrap";
import { ROUTE } from "@/app/constant/route";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
export default function Page() {
  return (
    <div>
      <StartDsfrOnHydration />
      <div className="min-h-screen bg-blue-background border border-transparent">
        <Container>
          <Breadcrumb
            currentPageLabel="Connexion à Administration+"
            homeLinkProps={{
              href: ROUTE.HOME,
            }}
            segments={[]}
          />
          <ResetPasswordForm />
        </Container>
      </div>
    </div>
  );
}
