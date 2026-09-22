"use client";

/* chore */
import { useState } from "react";

/* dsfr */
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import { Alert } from "@codegouvfr/react-dsfr/Alert";

/* trpc */
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

type Status = "idle" | "loading" | "success" | "error";

export function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const trpc = useTRPC();

  const mutation = useMutation(
    trpc.user.requestPasswordReset.mutationOptions({
      onSuccess: () => {
        setStatus("success");
      },
      onError: (err) => {
        setStatus("error");
        setError(err.message);
      },
    }),
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString();
    if (!email) {
      return;
    }
    setStatus("loading");
    mutation.mutate({ email });
  }
  return (
    <div className=" px-4 max-w-[640px] mx-auto">
      <h1>Mot de passe oublié</h1>

      <div className=" px-4 bg-white p-8 lg:p-16 ">
        <h2 className="text-[32px] font-bold leading-[40px] text-[#161616] mb-8">
          Réinitialiser le mot de passe
        </h2>
        {status === "success" && (
          <div>
            <Alert
              role="status"
              className="w-full "
              title=""
              severity="success"
              description="Si un compte est associé à cette adresse électronique, vous allez recevoir un courriel. Cliquez sur le lien dans le courriel pour réinitialiser votre mot de passe."
            />
            <p className="mt-4 text-sm text-gray-500">
              La réception du courriel peut prendre plusieurs minutes. Pensez à
              vérifier vos spams.
            </p>
          </div>
        )}
        {status === "error" && (
          <Alert severity="error" title="" description={error} />
        )}
        {(status === "idle" || status === "loading") && (
          <>
            <p>
              Saisissez votre adresse e-mail et cliquez sur{" "}
              <i>Envoyer l&apos;e-mail de réinitialisation</i>. Vous recevrez un
              e-mail qui vous permettra de réinitialiser votre mot de passe.
            </p>
            <form onSubmit={handleSubmit}>
              <Input
                nativeInputProps={{
                  type: "email",
                  autoComplete: "email",
                  name: "email",
                  autoFocus: true,
                  disabled: status === "loading",
                }}
                className="mt-4"
                label="Adresse e-mail"
                id="email"
              />
              <Button
                className="w-full mt-6 justify-center"
                type="submit"
                disabled={status === "loading"}
              >
                {status === "loading"
                  ? "Envoi en cours..."
                  : "Envoyer l’e-mail de réinitialisation"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
