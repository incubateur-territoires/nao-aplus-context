"use client";

import { Container } from "@/app/component/container/container";
import { ROUTE } from "@/app/constant/route";
import Button from "@codegouvfr/react-dsfr/Button";
import { useEffect } from "react";

export default function PrivateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container>
      <div className="flex flex-col items-center py-20 text-center">
        <h1>Une erreur est survenue</h1>
        <p className="fr-text--lg mb-8">
          Une erreur inattendue s&apos;est produite. Veuillez réessayer.
        </p>
        <div className="flex gap-4">
          <Button priority="secondary" onClick={reset}>
            Réessayer
          </Button>
          <Button linkProps={{ href: ROUTE.ALL_REPORTS }}>
            Retour aux signalements
          </Button>
        </div>
      </div>
    </Container>
  );
}
