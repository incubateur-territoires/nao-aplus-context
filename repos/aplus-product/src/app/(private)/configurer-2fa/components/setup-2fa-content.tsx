"use client";

import { useState } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import { PasswordInput } from "@codegouvfr/react-dsfr/blocks/PasswordInput";
import Alert from "@codegouvfr/react-dsfr/Alert";
import QRCode from "react-qr-code";
import { authClient } from "@/lib/auth-client";
import { ROUTE } from "@/app/constant/route";

type Step = "password" | "qrcode" | "verify" | "backup-codes";

export function Setup2faContent() {
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await authClient.twoFactor.enable({
        password,
      });

      if (result.error) {
        setError("Mot de passe incorrect.");
        setIsLoading(false);
        return;
      }

      setTotpURI(result.data?.totpURI ?? "");
      setBackupCodes(result.data?.backupCodes ?? []);
      setStep("qrcode");
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  // Extract secret from totpURI (otpauth://totp/...?secret=XXX&...)
  function getSecretFromURI(uri: string): string {
    try {
      const url = new URL(uri);
      return url.searchParams.get("secret") ?? "";
    } catch {
      return "";
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code,
      });

      if (result.error) {
        setError("Code invalide. Veuillez réessayer.");
        setIsLoading(false);
        return;
      }

      setStep("backup-codes");
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleFinish() {
    window.location.href = ROUTE.ALL_REPORTS;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Indicateur d'étape */}
      <nav aria-label="Étapes de configuration">
        <ol className="flex gap-2 items-center text-sm text-[#666666] list-none p-0 m-0">
          <li aria-current={step === "password" ? "step" : undefined}>
            <span
              className={step === "password" ? "font-bold text-blue-500" : ""}
            >
              1. Mot de passe
            </span>
          </li>
          <li aria-hidden="true">→</li>
          <li aria-current={step === "qrcode" ? "step" : undefined}>
            <span
              className={step === "qrcode" ? "font-bold text-blue-500" : ""}
            >
              2. QR Code
            </span>
          </li>
          <li aria-hidden="true">→</li>
          <li aria-current={step === "verify" ? "step" : undefined}>
            <span
              className={step === "verify" ? "font-bold text-blue-500" : ""}
            >
              3. Vérification
            </span>
          </li>
          <li aria-hidden="true">→</li>
          <li aria-current={step === "backup-codes" ? "step" : undefined}>
            <span
              className={
                step === "backup-codes" ? "font-bold text-blue-500" : ""
              }
            >
              4. Codes de secours
            </span>
          </li>
        </ol>
      </nav>

      {error && (
        <Alert severity="error" title="Erreur" description={error} small />
      )}

      {/* Étape 1 : Mot de passe */}
      {step === "password" && (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          <p>
            Pour configurer la vérification en deux étapes, veuillez confirmer
            votre mot de passe.
          </p>
          <PasswordInput
            label="Mot de passe"
            nativeInputProps={{
              value: password,
              onChange: (e) => setPassword(e.target.value),
              autoFocus: true,
            }}
          />
          <Button type="submit" disabled={isLoading || password.length === 0}>
            {isLoading ? "Vérification..." : "Continuer"}
          </Button>
        </form>
      )}

      {/* Étape 2 : QR Code */}
      {step === "qrcode" && (
        <div className="flex flex-col gap-6">
          <p>
            Scannez ce QR code avec votre application d&apos;authentification
            (Google Authenticator, Authy, etc.).
          </p>
          <div className="flex justify-center p-6 bg-white rounded-lg border">
            <QRCode value={totpURI} size={200} />
          </div>
          <details className="fr-text--sm">
            <summary className="cursor-pointer text-blue-500">
              Impossible de scanner le QR code ?
            </summary>
            <div className="mt-2 p-4 bg-[#f5f5fe] rounded">
              <p className="text-sm mb-1">
                Entrez cette clé manuellement dans votre application :
              </p>
              <code className="text-sm font-mono break-all select-all">
                {getSecretFromURI(totpURI)}
              </code>
            </div>
          </details>
          <Button type="button" onClick={() => setStep("verify")}>
            J&apos;ai scanné le QR code
          </Button>
        </div>
      )}

      {/* Étape 3 : Vérification */}
      {step === "verify" && (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
          <p>
            Entrez le code à 6 chiffres affiché dans votre application
            d&apos;authentification pour vérifier la configuration.
          </p>
          <Input
            label="Code de vérification"
            nativeInputProps={{
              type: "text",
              inputMode: "numeric",
              autoComplete: "one-time-code",
              pattern: "[0-9]{6}",
              maxLength: 6,
              value: code,
              onChange: (e) => setCode(e.target.value),
              autoFocus: true,
            }}
          />
          <Button type="submit" disabled={isLoading || code.length !== 6}>
            {isLoading ? "Vérification..." : "Vérifier et activer"}
          </Button>
        </form>
      )}

      {/* Étape 4 : Codes de secours */}
      {step === "backup-codes" && (
        <div className="flex flex-col gap-6">
          <Alert
            severity="success"
            title="Vérification en deux étapes activée"
            description="Votre compte est maintenant protégé par la vérification en deux étapes."
            small
          />
          <div>
            <h3 className="fr-text--lg font-bold mb-2">Codes de secours</h3>
            <p className="mb-4">
              Conservez ces codes dans un endroit sûr. Chaque code ne peut être
              utilisé qu&apos;une seule fois pour vous connecter si vous perdez
              accès à votre application d&apos;authentification.
            </p>
            <div className="p-4 bg-[#f5f5fe] rounded-lg border font-mono text-sm grid grid-cols-2 gap-2">
              {backupCodes.map((backupCode) => (
                <span key={backupCode} className="select-all">
                  {backupCode}
                </span>
              ))}
            </div>
          </div>
          <Button type="button" onClick={handleFinish}>
            J&apos;ai noté mes codes de secours
          </Button>
        </div>
      )}
    </div>
  );
}
