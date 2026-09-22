import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import Button from "@codegouvfr/react-dsfr/Button";

export default function NotFound() {
  return (
    <Container>
      <div className="flex flex-col items-center py-20 text-center">
        <h1>Page non trouvée</h1>
        <p className="fr-text--lg mb-8">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Button linkProps={{ href: ROUTE.ALL_REPORTS }}>
          Retour aux signalements
        </Button>
      </div>
    </Container>
  );
}
