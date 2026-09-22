"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@codegouvfr/react-dsfr/Input";
import Select from "@codegouvfr/react-dsfr/Select";
import Button from "@codegouvfr/react-dsfr/Button";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { useTRPC } from "@/trpc/client";
import { ROUTE } from "@/app/constant/route";
import { InputFile } from "@/app/component/ui/input-file/input-file";
import { fileToBase64 } from "@/utils/file";
import { useContactFeedback } from "../contact-feedback-provider/contact-feedback-provider";
import { useFocusOnVisible } from "@/app/hooks/use-focus-on-visible";
import {
  contactFormSchema,
  type ContactFormValues,
} from "./contact-form.schema";

export function ContactForm() {
  const trpc = useTRPC();
  const { setIsSent } = useContactFeedback();

  const { data: user } = useQuery(trpc.user.getCurrentUser.queryOptions());
  const isLoggedIn = Boolean(user);
  const teams = user?.teams ?? [];
  const hasSingleTeam = teams.length === 1;
  const hasMultipleTeams = teams.length > 1;
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      team: "",
      subject: "",
      message: "",
      files: [],
    },
  });

  // Prefill the identity fields (and the team when there is only one) from the
  // logged-in user once the query resolves.
  useEffect(() => {
    if (!user) return;
    setValue("email", user.email);
    setValue("firstName", user.firstName);
    setValue("lastName", user.lastName);
    if (user.teams.length === 1) {
      setValue("team", user.teams[0].name);
    }
  }, [user, setValue]);

  const { mutate, isPending, isError, error } = useMutation(
    trpc.contact.send.mutationOptions({
      onSuccess: () => {
        // The confirmation alert lives at the top of the page; it handles its
        // own focus and scroll (via useFocusOnVisible) when `isSent` turns true.
        setIsSent(true);
        reset();
      },
    }),
  );

  // Move focus (and scroll) to the error alert when it appears, like every
  // other dynamic Alert in the app. The wrapper must carry `tabIndex={-1}`.
  const errorRef = useFocusOnVisible<HTMLDivElement>(isError);

  async function onSubmit(data: ContactFormValues) {
    setIsSent(false);
    const { files, ...rest } = data;
    // Les fichiers sont joints directement à l'email (encodés en base64),
    // comme attendu par l'API de pièces jointes Brevo.
    const attachments = await Promise.all(
      (files ?? []).map(async (file) => ({
        name: file.name,
        content: await fileToBase64(file),
      })),
    );
    mutate({ ...rest, attachments });
  }

  return (
    <section>
      <h2>Vous ne trouvez pas la réponse à votre question ?</h2>

      <p className="fr-mt-3w">
        Si votre question ne figure pas dans la liste ci-dessus et que vous ne
        trouvez pas la réponse{" "}
        <Link href={ROUTE.HELP} target="_blank" rel="noopener noreferrer">
          dans notre aide en ligne
          <span className="sr-only"> - nouvelle fenêtre</span>
        </Link>
        , utilisez le formulaire suivant pour nous contacter. Notre équipe de
        support répond généralement sous 1 à 2 jours ouvrés.
      </p>

      <p>Tous les champs sont obligatoires sauf mention contraire.</p>

      <div ref={errorRef} tabIndex={-1}>
        {isError && (
          <Alert
            severity="error"
            role="alert"
            title="L'envoi du message a échoué."
            description={
              // Server-thrown errors (rate limit, send failure…) carry a
              // French message in `error.data`; network errors do not, so we
              // fall back to a generic French message instead of "Failed to fetch".
              error.data
                ? error.message
                : "Une erreur est survenue lors de l'envoi de votre message. Vérifiez votre connexion et réessayez."
            }
            className="fr-mb-4w"
          />
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Input
          label="Adresse e-mail de votre compte A+"
          hintText="Si vous n'avez pas de compte A+, saisissez une adresse e-mail permettant de vous recontacter. Exemple : prenom.nom@exemple.fr"
          state={errors.email ? "error" : "default"}
          stateRelatedMessage={errors.email?.message}
          disabled={isLoggedIn}
          className="md:max-w-80"
          nativeInputProps={{
            type: "email",
            autoComplete: "email",
            "aria-required": true,
            ...register("email"),
          }}
        />

        <Input
          label="Prénom"
          state={errors.firstName ? "error" : "default"}
          stateRelatedMessage={errors.firstName?.message}
          disabled={isLoggedIn}
          className="md:max-w-80"
          nativeInputProps={{
            type: "text",
            autoComplete: "given-name",
            "aria-required": true,
            ...register("firstName"),
          }}
        />

        <Input
          label="Nom"
          state={errors.lastName ? "error" : "default"}
          stateRelatedMessage={errors.lastName?.message}
          disabled={isLoggedIn}
          className="md:max-w-80"
          nativeInputProps={{
            type: "text",
            autoComplete: "family-name",
            "aria-required": true,
            ...register("lastName"),
          }}
        />

        {hasMultipleTeams ? (
          <Select
            label="Équipe concernée (optionnel)"
            className="md:max-w-80"
            nativeSelectProps={{ ...register("team") }}
          >
            <option value="">Sélectionnez une équipe</option>
            {teams.map((team) => (
              <option key={team.id} value={team.name}>
                {team.name}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            label={
              hasSingleTeam
                ? "Équipe concernée"
                : "Équipe concernée (optionnel)"
            }
            disabled={hasSingleTeam}
            className="md:max-w-80"
            nativeInputProps={{
              type: "text",
              ...register("team"),
            }}
          />
        )}

        <Input
          label="Sujet du message"
          state={errors.subject ? "error" : "default"}
          stateRelatedMessage={errors.subject?.message}
          nativeInputProps={{
            type: "text",
            "aria-required": true,
            ...register("subject"),
          }}
        />

        <Input
          label="Message"
          textArea
          state={errors.message ? "error" : "default"}
          stateRelatedMessage={errors.message?.message}
          nativeTextAreaProps={{
            rows: 6,
            "aria-required": true,
            ...register("message"),
          }}
        />

        <Controller
          control={control}
          name="files"
          render={({ field }) => (
            <InputFile
              name="contact-files"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <div className="flex md:justify-end">
          <Button
            type="submit"
            size="large"
            iconId="ri-send-plane-fill"
            iconPosition="left"
            disabled={isPending}
            className="w-full md:w-fit flex justify-center"
          >
            Envoyer le message
          </Button>
        </div>
      </form>
    </section>
  );
}
