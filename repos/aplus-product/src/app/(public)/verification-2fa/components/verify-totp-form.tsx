"use client";

import { useState } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { authClient } from "@/lib/auth-client";
import { getSafeReturnTo } from "@/utils/return-to";

export function VerifyTotpForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackupMode, setIsBackupMode] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isBackupMode) {
        const result = await authClient.twoFactor.verifyBackupCode({
          code,
        });
        if (result.error) {
          setError("Code de secours invalide.");
          setIsLoading(false);
          return;
        }
      } else {
        const result = await authClient.twoFactor.verifyTotp({
          code,
        });
        if (result.error) {
          setError("Code invalide. Veuillez réessayer.");
          setIsLoading(false);
          return;
        }
      }
      const returnTo = new URLSearchParams(window.location.search).get(
        "returnTo",
      );
      window.location.href = getSafeReturnTo(returnTo);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <Alert severity="error" title="Erreur" description={error} small />
      )}

      <Input
        label={
          isBackupMode ? "Code de secours" : "Code de vérification à 6 chiffres"
        }
        hintText={
          isBackupMode
            ? "Entrez l'un de vos codes de secours"
            : "Ouvrez votre application d'authentification et saisissez le code affiché"
        }
        nativeInputProps={{
          type: "text",
          inputMode: isBackupMode ? "text" : "numeric",
          autoComplete: "one-time-code",
          pattern: isBackupMode ? undefined : "[0-9]{6}",
          maxLength: isBackupMode ? 10 : 6,
          value: code,
          onChange: (e) => setCode(e.target.value),
          autoFocus: true,
        }}
      />

      <Button type="submit" disabled={isLoading || code.length === 0}>
        {isLoading ? "Vérification..." : "Vérifier"}
      </Button>

      <Button
        type="button"
        priority="tertiary no outline"
        onClick={() => {
          setIsBackupMode(!isBackupMode);
          setCode("");
          setError(null);
        }}
      >
        {isBackupMode
          ? "Utiliser le code de l'application"
          : "Utiliser un code de secours"}
      </Button>
    </form>
  );
}
