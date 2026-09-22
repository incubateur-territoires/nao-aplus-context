import type { Metadata } from "next";
import { StartDsfrOnHydration } from "@/dsfr-bootstrap";
import { Container } from "@/app/component/container/container";
import { PseudonymizeTester } from "@/app/component/pseudonymize-tester/pseudonymize-tester";

export const metadata: Metadata = {
  title: "Test pseudonymisation",
  robots: { index: false, follow: false },
};

export default function TestPseudonymisationPage() {
  return (
    <>
      <StartDsfrOnHydration />
      <Container className="fr-mt-4w">
        <h1>Test — couche A de pseudonymisation</h1>
        <p className="fr-text--sm fr-text-mention--grey">
          Outil de développement. Détection locale et déterministe (numéros ≥ 7
          chiffres + dictionnaire de noms), sans appel LLM ni clé API.
        </p>
        <PseudonymizeTester />
      </Container>
    </>
  );
}
