"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import Checkbox from "@codegouvfr/react-dsfr/Checkbox";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { PasswordInput } from "@codegouvfr/react-dsfr/blocks/PasswordInput";
import { ROUTE } from "@/app/constant/route";
import { signIn } from "@/lib/auth-client";
import {
  finishRegistrationSchema,
  FinishRegistrationFormValues,
} from "./schema";
import { Spinner } from "@/app/component/spinner/spinner";
import Link from "next/link";
import { useAnalytics } from "@/app/hooks/use-analytics";

interface FinishRegistrationContentProps {
  token?: string;
}

export function FinishRegistrationContent({
  token,
}: FinishRegistrationContentProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const { track } = useAnalytics();

  // Validate token on load
  const {
    data: tokenValidation,
    isLoading: isValidating,
    error: tokenError,
  } = useQuery({
    ...trpc.user.validateToken.queryOptions({ token: token ?? "" }),
    enabled: !!token,
  });

  const formMethods = useForm<FinishRegistrationFormValues>({
    resolver: zodResolver(finishRegistrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      password: "",
      passwordConfirmation: "",
      phone: "",
      profession: "",
      cguAccepted: false,
    },
    mode: "onSubmit",
    values: tokenValidation?.pendingUser
      ? {
          firstName: tokenValidation.pendingUser.firstName ?? "",
          lastName: tokenValidation.pendingUser.lastName ?? "",
          password: "",
          passwordConfirmation: "",
          phone: "",
          profession: "",
          cguAccepted: false,
        }
      : undefined,
  });

  const [isSigningIn, setIsSigningIn] = useState(false);

  const {
    mutateAsync: completeRegistration,
    isPending,
    error: registrationError,
  } = useMutation(trpc.user.completeRegistration.mutationOptions());

  async function onSubmit(data: FinishRegistrationFormValues) {
    if (!token) return;
    try {
      const result = await completeRegistration({
        token,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        passwordConfirmation: data.passwordConfirmation,
        phone: data.phone === "" ? null : data.phone,
        profession: data.profession === "" ? null : data.profession,
        cguAccepted: data.cguAccepted,
      });

      // Track registration completion
      track("auth_registration_complete", {
        hasPhone: !!data.phone,
        hasProfession: !!data.profession,
      });

      // Sign in the user client-side
      setIsSigningIn(true);
      const signInResult = await signIn.email({
        email: result.email,
        password: data.password,
      });

      if (signInResult.error) {
        // If sign-in fails, redirect to login page
        router.push(ROUTE.LOGIN);
      } else {
        router.push(ROUTE.HOME);
        router.refresh();
      }
    } catch (error) {
      console.error("Error completing registration:", error);
    }
  }

  // No token provided
  if (!token) {
    return (
      <div className="bg-white p-20 mb-8">
        <Alert
          severity="error"
          title="Lien invalide"
          description="Le lien d'invitation est invalide. Veuillez vérifier le lien reçu par email ou contacter votre administrateur."
        />
      </div>
    );
  }

  // Loading state
  if (isValidating) {
    return (
      <div className="bg-white p-20 mb-8">
        <div className="flex justify-center items-center h-32">
          <Spinner />
        </div>
      </div>
    );
  }

  // Token validation error
  if (tokenError || !tokenValidation?.valid) {
    if (tokenValidation?.error === "TOKEN_EXPIRED") {
      return (
        <div className="bg-white p-20 mb-8">
          <Alert
            severity="error"
            title="Lien d'invitation expiré"
            description={
              <>
                Ce lien d&apos;invitation n&apos;est plus valide. Contactez le
                responsable de votre équipe et demandez-lui de vous
                <Link
                  target="_blank"
                  href="https://docs.aplus.beta.gouv.fr/vous-etes-responsable-dequipe/renvoyer-une-invitation-a-un-futur-membre"
                  rel="noopener noreferrer"
                >
                  renvoyer une invitation
                  <span className="sr-only"> - nouvelle fenêtre</span>
                </Link>
                <br />
                <br />
                Si le problème persiste, vous pouvez{" "}
                <Link href="https://docs.aplus.beta.gouv.fr/contacter-lequipe">
                  contacter notre support
                </Link>
                .
              </>
            }
          />
        </div>
      );
    }

    const errorMessage = getErrorMessage(tokenValidation?.error);
    return (
      <div className="bg-white p-20 mb-8">
        <Alert
          severity="error"
          title={errorMessage.title}
          description={errorMessage.description}
        />
      </div>
    );
  }

  // log values
  return (
    <div className="bg-white p-20 mb-8">
      <form onSubmit={formMethods.handleSubmit(onSubmit)}>
        <div className="flex flex-col">
          {/* Personal information form */}
          <section className="flex flex-col">
            <h2>Informations personnelles</h2>
            <p>Tous les champs sont obligatoires sauf mention contraire.</p>

            <div className="flex flex-col gap-4 mt-4">
              <Controller
                control={formMethods.control}
                name="firstName"
                render={({ field }) => (
                  <Input
                    state={
                      formMethods.formState.errors.firstName
                        ? "error"
                        : "default"
                    }
                    stateRelatedMessage={
                      formMethods.formState.errors.firstName?.message
                    }
                    label="Prénom"
                    nativeInputProps={{
                      ...field,
                      value: field.value ?? "",
                      onChange: (e) => {
                        field.onChange(e.target.value);
                      },
                    }}
                  />
                )}
              />

              <Controller
                control={formMethods.control}
                name="lastName"
                render={({ field }) => (
                  <Input
                    state={
                      formMethods.formState.errors.lastName
                        ? "error"
                        : "default"
                    }
                    stateRelatedMessage={
                      formMethods.formState.errors.lastName?.message
                    }
                    label="Nom"
                    nativeInputProps={{
                      ...field,
                      value: field.value ?? "",
                      onChange: (e) => {
                        field.onChange(e.target.value);
                      },
                    }}
                  />
                )}
              />

              <Controller
                control={formMethods.control}
                name="profession"
                render={({ field }) => (
                  <Input
                    state={
                      formMethods.formState.errors.profession
                        ? "error"
                        : "default"
                    }
                    stateRelatedMessage={
                      formMethods.formState.errors.profession?.message
                    }
                    label="Profession (optionnel)"
                    nativeInputProps={{
                      ...field,
                      value: field.value ?? "",
                      onChange: (e) => {
                        field.onChange(e.target.value);
                      },
                    }}
                  />
                )}
              />

              <Controller
                control={formMethods.control}
                name="phone"
                render={({ field }) => (
                  <Input
                    state={
                      formMethods.formState.errors.phone ? "error" : "default"
                    }
                    stateRelatedMessage={
                      formMethods.formState.errors.phone?.message
                    }
                    label="Numéro de téléphone (optionnel)"
                    nativeInputProps={{
                      ...field,
                      type: "tel",
                      autoComplete: "tel",
                      value: field.value ?? "",
                      onChange: (e) => {
                        field.onChange(e.target.value);
                      },
                    }}
                  />
                )}
              />
            </div>
          </section>

          {/* Password section */}
          <section className="flex flex-col mt-8">
            <h2>Mot de passe</h2>
            <p>Choisissez un mot de passe sécurisé.</p>

            <div className="flex flex-col gap-4 mt-4">
              <Controller
                control={formMethods.control}
                name="password"
                render={({ field }) => (
                  <PasswordInput
                    label="Mot de passe"
                    messages={
                      formMethods.formState.errors.password
                        ? [
                            {
                              message:
                                formMethods.formState.errors.password.message ??
                                "",
                              severity: "error",
                            },
                          ]
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
                    nativeInputProps={{
                      ...field,
                      value: field.value ?? "",
                      onChange: (e) => {
                        field.onChange(e.target.value);
                      },
                    }}
                  />
                )}
              />

              <Controller
                control={formMethods.control}
                name="passwordConfirmation"
                render={({ field }) => (
                  <PasswordInput
                    label="Confirmer le mot de passe"
                    messages={
                      formMethods.formState.errors.passwordConfirmation
                        ? [
                            {
                              message:
                                formMethods.formState.errors
                                  .passwordConfirmation.message ?? "",
                              severity: "error",
                            },
                          ]
                        : []
                    }
                    nativeInputProps={{
                      ...field,
                      value: field.value ?? "",
                      onChange: (e) => {
                        field.onChange(e.target.value);
                      },
                    }}
                  />
                )}
              />
            </div>
          </section>

          {/* CGU acceptance */}
          <section className="flex flex-col mt-8">
            <Controller
              control={formMethods.control}
              name="cguAccepted"
              render={({ field }) => (
                <Checkbox
                  state={
                    formMethods.formState.errors.cguAccepted
                      ? "error"
                      : "default"
                  }
                  stateRelatedMessage={
                    formMethods.formState.errors.cguAccepted?.message
                  }
                  options={[
                    {
                      label: (
                        <span>
                          J&apos;atteste avoir consulté les{" "}
                          <Link
                            href={ROUTE.CGU}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            conditions générales d&apos;utilisation du 1er août
                            2025
                            <span className="sr-only"> - nouvelle fenêtre</span>
                          </Link>{" "}
                          et je m&apos;engage à les respecter.
                        </span>
                      ),
                      nativeInputProps: {
                        name: "cguAccepted",
                        checked: field.value,
                        onChange: (e) => {
                          field.onChange(e.target.checked);
                        },
                      },
                    },
                  ]}
                />
              )}
            />
          </section>

          {/* Error message */}
          {registrationError && (
            <Alert
              className="mt-4"
              severity="error"
              title="Erreur"
              description={registrationError.message}
            />
          )}

          {/* Submit button */}
          <div className="flex justify-end mt-10">
            <Button
              type="submit"
              disabled={isPending || isSigningIn}
              iconId="ri-check-line"
              size="large"
            >
              Terminer l&apos;inscription
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function getErrorMessage(error: string | null | undefined): {
  title: string;
  description: Exclude<ReactNode, null | undefined>;
} {
  switch (error) {
    case "TOKEN_INVALID":
      return {
        title: "Lien d'invitation invalide",
        description: (
          <>
            Ce lien d&apos;invitation n&apos;est pas valide. Contactez le
            responsable de votre équipe et demandez-lui de vous{" "}
            <Link
              target="_blank"
              href="https://docs.aplus.beta.gouv.fr/vous-etes-responsable-dequipe/renvoyer-une-invitation-a-un-futur-membre"
              rel="noopener noreferrer"
            >
              renvoyer une invitation
              <span className="sr-only"> - nouvelle fenêtre</span>
            </Link>
            <br />
            <br />
            Si le problème persiste, vous pouvez{" "}
            <Link
              target="_blank"
              href="https://docs.aplus.beta.gouv.fr/contacter-lequipe"
              rel="noopener noreferrer"
            >
              contacter notre support
              <span className="sr-only"> - nouvelle fenêtre</span>
            </Link>
            .
          </>
        ),
      };
    case "TOKEN_EXPIRED":
      return {
        title: "Lien d'invitation expiré",
        description: (
          <>
            Ce lien d&apos;invitation n&apos;est plus valide. Contactez le
            responsable de votre équipe et demandez-lui de vous
            <Link
              target="_blank"
              href="https://docs.aplus.beta.gouv.fr/vous-etes-responsable-dequipe/renvoyer-une-invitation-a-un-futur-membre"
              rel="noopener noreferrer"
            >
              renvoyer une invitation
              <span className="sr-only"> - nouvelle fenêtre</span>
            </Link>
            <br />
            <br />
            Si le problème persiste, vous pouvez{" "}
            <Link
              target="_blank"
              href="https://docs.aplus.beta.gouv.fr/contacter-lequipe"
              rel="noopener noreferrer"
            >
              contacter notre support
              <span className="sr-only"> - nouvelle fenêtre</span>
            </Link>
            .
          </>
        ),
      };
    case "USER_EXISTS":
      return {
        title: "Un compte existe déjà",
        description:
          "Un compte existe déjà avec cette adresse e-mail. Vous pouvez vous connecter directement.",
      };
    default:
      return {
        title: "Erreur",
        description:
          "Une erreur est survenue. Veuillez réessayer ou contacter votre administrateur.",
      };
  }
}
