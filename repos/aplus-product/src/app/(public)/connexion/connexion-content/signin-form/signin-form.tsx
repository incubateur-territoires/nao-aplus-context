"use client";

/* chore */

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

/* forms */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

/* dsfr */
import Alert from "@codegouvfr/react-dsfr/Alert";
import { ROUTE } from "@/app/constant/route";
import { signIn } from "@/lib/auth-client";
import { getSafeReturnTo } from "@/utils/return-to";
import Input from "@codegouvfr/react-dsfr/Input";
import { PasswordInput } from "@codegouvfr/react-dsfr/blocks/PasswordInput";
import Button from "@codegouvfr/react-dsfr/Button";

const signinSchema = z.object({
  email: z
    .string()
    .min(1, "Veuillez saisir votre adresse e-mail.")
    .email(
      "Veuillez saisir une adresse e-mail valide. Exemple : m.dupont@gmail.com",
    ),
  password: z.string().min(1, "Veuillez saisir votre mot de passe."),
});

type SigninFormValues = z.infer<typeof signinSchema>;

interface SigninFormProps {
  onOpenTestUsers?: () => void;
  prefillEmail?: string;
  prefillPassword?: string;
}

export function SigninForm({
  onOpenTestUsers,
  prefillEmail,
  prefillPassword,
}: SigninFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("error");

  const enableTestUsers = process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS === "true";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SigninFormValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: {
      email: prefillEmail ?? "",
      password: prefillPassword ?? "",
    },
  });

  async function onSubmit(data: SigninFormValues) {
    const response = await signIn.email({
      email: data.email.toLowerCase(),
      password: data.password,
      callbackURL: getSafeReturnTo(searchParams.get("returnTo")),
    });

    if (response.error) {
      const errorMessage = response.error.message;
      const errorStatus = response.error.status;
      if (errorStatus === 429) {
        router.replace(`${ROUTE.LOGIN}?error=RateLimited`);
      } else if (errorMessage === "AccountInactive") {
        router.replace(`${ROUTE.LOGIN}?error=AccountInactive`);
      } else {
        router.replace(`${ROUTE.LOGIN}?error=CredentialsSignin`);
      }
    }
    // En cas de succès, la connexion est tracée côté serveur (hook better-auth
    // `after`) : le client redirige (rechargement complet via callbackURL) avant
    // que la session soit disponible, ce qui rendait le tracking client
    // inattribuable — a fortiori pour les comptes 2FA.
  }

  function getErrorMessage(query: string | null) {
    if (!query) {
      return null;
    }
    switch (query) {
      case "CredentialsSignin":
        return {
          severity: "error" as const,
          title: "Adresse e-mail ou mot de passe invalide.",
          message: (
            <>
              <p>
                Vérifiez l&apos;adresse e-mail et le mot de passe saisis. En cas
                de problème, vous pouvez{" "}
                <Link href={ROUTE.FORGOT_PASSWORD} className="w-fit">
                  réinitialiser votre mot de passe.
                </Link>
              </p>
            </>
          ),
        };
      case "AccountPending":
        return {
          severity: "info" as const,
          message: (
            <>
              Votre compte a été créé avec succès ! Un administrateur doit
              l&apos;activer avant que vous puissiez vous connecter.
              <br />
              <br />
              Vous recevrez un email de confirmation dès que votre compte sera
              activé. Pour toute question, contactez-nous à{" "}
              <a href="mailto:tous-connectes@incubateur.anct.gouv.fr">
                tous-connectes@incubateur.anct.gouv.fr
              </a>
            </>
          ),
        };
      case "AccessDenied":
        return {
          severity: "error" as const,
          message: (
            <>
              Pour activer votre compte, consulter le courriel de confirmation
              reçu suite à votre inscription sur la plateforme.
            </>
          ),
        };
      case "AccountInactive":
        return {
          severity: "error" as const,
          message: (
            <div className="inline-block">
              Ce compte a été désactivé. Si vous souhaitez vous connecter à
              nouveau à Administration+, contactez votre responsable
              d&apos;équipe ou{" "}
              <Link
                target="_blank"
                href="https://docs.aplus.beta.gouv.fr/contacter-lequipe"
                className="w-fit"
              >
                notre support
                <span className="sr-only"> - nouvelle fenêtre</span>
              </Link>
              .
            </div>
          ),
        };
      case "RateLimited":
        return {
          severity: "error" as const,
          title: "Trop de tentatives de connexion",
          message: (
            <p>
              Vous avez effectué trop de tentatives de connexion. Veuillez
              réessayer dans quelques minutes.
            </p>
          ),
        };
      default:
        return {
          severity: "error" as const,
          message: "Une erreur est survenue lors de la connexion.",
        };
    }
  }

  const error = getErrorMessage(query);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-8"
    >
      {error && (
        <Alert
          data-testid="error-message"
          severity={error.severity}
          title={error.title || ""}
          description={
            <div className="flex flex-col gap-2">{error.message}</div>
          }
        />
      )}
      <h2 className="mb-8">Connexion avec mot de passe</h2>
      {/* Email Input */}
      <div className="flex flex-col gap-2">
        <Input
          label="Adresse e-mail (obligatoire)"
          hintText="Format attendu : nom@domaine.fr. Exemple : m.dupont@gmail.com"
          state={errors.email ? "error" : "default"}
          stateRelatedMessage={errors.email?.message}
          nativeInputProps={{
            type: "email",
            autoComplete: "email",
            ...register("email"),
          }}
        />
      </div>

      {/* Password Input */}
      <div className="flex flex-col gap-1.5">
        <PasswordInput
          label="Mot de passe (obligatoire)"
          messagesHint=""
          messages={
            errors.password
              ? [{ severity: "error", message: errors.password.message }]
              : []
          }
          nativeInputProps={{
            autoComplete: "current-password",
            ...register("password"),
          }}
        />

        <Link
          href={ROUTE.FORGOT_PASSWORD}
          className="inline-block text-blue-primary text-base  mt-3 w-fit"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        {enableTestUsers && onOpenTestUsers ? (
          <Button
            type="button"
            onClick={onOpenTestUsers}
            priority="secondary"
            size="large"
          >
            Utilisateur de test
          </Button>
        ) : null}
        <Button
          type="submit"
          priority="primary"
          size="large"
          disabled={isSubmitting}
        >
          Se connecter
        </Button>
      </div>
    </form>
  );
}
