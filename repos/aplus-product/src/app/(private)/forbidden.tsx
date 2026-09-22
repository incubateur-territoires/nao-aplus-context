import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import Button from "@codegouvfr/react-dsfr/Button";

export default function Forbidden() {
  return (
    <Container>
      <div className="flex flex-col items-center py-20 text-center">
        <h1>Accès refusé</h1>
        <p className="fr-text--lg mb-8">
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
        </p>
        <Button linkProps={{ href: ROUTE.ALL_REPORTS }}>
          Retour aux signalements
        </Button>
      </div>
    </Container>
  );
}
