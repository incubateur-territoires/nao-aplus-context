"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import Checkbox from "@codegouvfr/react-dsfr/Checkbox";
import { useTRPC } from "@/trpc/client";
import { ROUTE } from "@/app/constant/route";
import { CGU_RELEASE_NOTES_URL } from "@/constants/cgu";
import { getSafeReturnTo } from "@/utils/return-to";

export function CguAcceptanceContent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const [isAccepted, setIsAccepted] = useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  const acceptCgu = useMutation(
    trpc.user.acceptCgu.mutationOptions({
      // Attendre le rafraîchissement avant de naviguer : la barrière relit
      // getCguStatus et renverrait ici sur la valeur périmée.
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.user.getCguStatus.queryKey(),
        });
        const returnTo = new URLSearchParams(window.location.search).get(
          "returnTo",
        );
        router.replace(getSafeReturnTo(returnTo));
      },
    }),
  );

  const missesAttestation = hasSubmitted && !isAccepted;

  // RGAA 11.10 : le focus revient sur la case en erreur, qui porte le message.
  // Le DSFR remonte le champ quand il passe en erreur, d'où l'effet plutôt
  // qu'un focus posé dans le gestionnaire de clic.
  useEffect(() => {
    if (missesAttestation) {
      checkboxRef.current?.focus();
    }
  }, [missesAttestation]);

  function handleSubmit() {
    setHasSubmitted(true);
    if (isAccepted) {
      acceptCgu.mutate();
    }
  }

  return (
    <>
      <p>
        Les{" "}
        <a
          href={ROUTE.CGU}
          target="_blank"
          rel="noopener noreferrer"
          title="conditions générales d'utilisation - nouvelle fenêtre"
        >
          conditions générales d&apos;utilisation
        </a>{" "}
        d&apos;Administration+ ont évolué.{" "}
        <a
          href={CGU_RELEASE_NOTES_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Consultez notre page d'aide pour connaître les principales modifications - nouvelle fenêtre"
        >
          Consultez notre page d&apos;aide pour connaître les principales
          modifications
        </a>
        , puis validez les CGU ci-dessous.
      </p>

      <Checkbox
        className="fr-mt-5w fr-mb-0"
        state={missesAttestation ? "error" : "default"}
        stateRelatedMessage={
          missesAttestation
            ? "Cochez cette case pour valider les conditions générales d'utilisation."
            : undefined
        }
        options={[
          {
            label: (
              <span>
                J&apos;atteste avoir consulté les{" "}
                <a
                  href={ROUTE.CGU}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="conditions générales d'utilisation du 1er octobre 2026 - nouvelle fenêtre"
                >
                  conditions générales d&apos;utilisation du 1er octobre 2026
                </a>{" "}
                et je m&apos;engage à les respecter.
              </span>
            ),
            nativeInputProps: {
              name: "cguAccepted",
              ref: checkboxRef,
              checked: isAccepted,
              onChange: (event) => {
                setIsAccepted(event.target.checked);
              },
            },
          },
        ]}
      />

      {acceptCgu.isError && (
        <Alert
          severity="error"
          title="L'acceptation n'a pas pu être enregistrée"
          description="Une erreur est survenue, veuillez réessayer."
          className="fr-my-4w"
        />
      )}

      <div className="flex justify-end fr-mt-5w">
        <Button
          size="large"
          iconId="fr-icon-check-line"
          disabled={acceptCgu.isPending}
          onClick={handleSubmit}
        >
          Valider les conditions générales d&apos;utilisation
        </Button>
      </div>
    </>
  );
}
