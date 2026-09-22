"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import Button from "@codegouvfr/react-dsfr/Button";
import { PasswordInput } from "@codegouvfr/react-dsfr/blocks/PasswordInput";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { ROUTE } from "@/app/constant/route";
import Link from "next/link";
import { Spinner } from "@/app/component/spinner/spinner";

interface NewPasswordContentProps {
  token?: string;
}

type Status = "idle" | "loading" | "success" | "error";

export function NewPasswordContent({ token }: NewPasswordContentProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [validationErrors, setValidationErrors] = useState<{
    password?: string;
    passwordConfirmation?: string;
  }>({});

  const trpc = useTRPC();

  const { data: tokenValidation, isLoading: isValidating } = useQuery({
    ...trpc.user.validatePasswordResetToken.queryOptions({
      token: token ?? "",
    }),
    enabled: !!token,
  });

  const mutation = useMutation(
    trpc.user.resetPassword.mutationOptions({
      onSuccess: () => {
        setStatus("success");
      },
      onError: (err) => {
        setStatus("error");
        setError(err.message);
      },
    }),
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Client-side validation
    const errors: { password?: string; passwordConfirmation?: string } = {};

    if (
      password.length < 12 ||
      !/\d/.test(password) ||
      !/[^a-zA-Z0-9]/.test(password)
    ) {
      errors.password =
        "Le mot de passe doit contenir au moins 12 caractères, 1 chiffre et 1 caractère spécial.";
    }

    if (password !== passwordConfirmation) {
      errors.passwordConfirmation = "Les mots de passe ne correspondent pas.";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setStatus("loading");
    mutation.mutate({ token: token ?? "", password, passwordConfirmation });
  }

  // No token provided
  if (!token) {
    return (
      <div className="bg-white p-8 lg:p-16">
        <Alert
          severity="error"
          title="Lien invalide"
          description="Aucun token de réinitialisation fourni. Veuillez utiliser le lien reçu par email."
        />
        <Link href={ROUTE.FORGOT_PASSWORD}>
          <Button className="w-full mt-6 justify-center">
            Demander un nouveau lien
          </Button>
        </Link>
      </div>
    );
  }

  // Loading token validation
  if (isValidating) {
    return (
      <div className="bg-white p-8 lg:p-16 flex justify-center">
        <Spinner data-testid="spinner" />
      </div>
    );
  }

  // Invalid or expired token
  if (!tokenValidation?.valid) {
    return (
      <div className="bg-white p-8 lg:p-16">
        <Alert
          severity="error"
          title="Lien invalide"
          description={
            tokenValidation?.error === "TOKEN_EXPIRED"
              ? "Ce lien de réinitialisation a expiré. Veuillez en demander un nouveau."
              : "Ce lien de réinitialisation est invalide. Veuillez en demander un nouveau."
          }
        />
        <Link href={ROUTE.FORGOT_PASSWORD}>
          <Button className="w-full mt-6 justify-center">
            Demander un nouveau lien
          </Button>
        </Link>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="bg-white p-8 lg:p-16">
        <Alert
          severity="success"
          role="status"
          title="Mot de passe modifié"
          description="Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter."
        />
        <Link href={ROUTE.LOGIN}>
          <Button className="w-full mt-6 justify-center">Se connecter</Button>
        </Link>
      </div>
    );
  }

  // Form
  return (
    <div className="bg-white p-8 lg:p-16">
      <h2 className="text-[32px] font-bold leading-[40px] text-[#161616] mb-8">
        Définir un nouveau mot de passe
      </h2>

      {status === "error" && (
        <Alert severity="error" title="" description={error} className="mb-4" />
      )}

      <form onSubmit={handleSubmit}>
        <PasswordInput
          label="Nouveau mot de passe"
          nativeInputProps={{
            name: "password",
            autoComplete: "new-password",
            value: password,
            onChange: (e) => setPassword(e.target.value),
            disabled: status === "loading",
          }}
          messages={
            validationErrors.password
              ? [{ message: validationErrors.password, severity: "error" }]
              : [
                  {
                    message: "12 caractères minimum",
                    severity: "info",
                  },
                  {
                    message: "1 caractère spécial",
                    severity: "info",
                  },
                  {
                    message: "1 chiffre minimum",
                    severity: "info",
                  },
                ]
          }
        />

        <PasswordInput
          label="Confirmer le mot de passe"
          className="mt-4"
          nativeInputProps={{
            name: "passwordConfirmation",
            autoComplete: "new-password",
            value: passwordConfirmation,
            onChange: (e) => setPasswordConfirmation(e.target.value),
            disabled: status === "loading",
          }}
          messages={
            validationErrors.passwordConfirmation
              ? [
                  {
                    message: validationErrors.passwordConfirmation,
                    severity: "error",
                  },
                ]
              : undefined
          }
        />

        <Button
          className="w-full mt-6 justify-center"
          type="submit"
          iconId="ri-save-3-line"
          disabled={status === "loading"}
        >
          {status === "loading"
            ? "Modification en cours..."
            : "Enregistrer le nouveau mot de passe"}
        </Button>
      </form>
    </div>
  );
}
