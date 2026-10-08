"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import { useTRPC } from "@/trpc/client";
import {
  sendEmailSchema,
  type SendEmailFormValues,
} from "../send-email-schema";

interface SendEmailFormProps {
  contactId: string;
}

export function SendEmailForm({ contactId }: SendEmailFormProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm<SendEmailFormValues>({
    resolver: zodResolver(sendEmailSchema),
    defaultValues: { subject: "", content: "" },
  });

  const { mutate: sendEmail, isPending } = useMutation(
    trpc.crm.sendEmail.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.crm.getContactById.queryKey({ id: contactId }),
        });
        reset();
        setErrorMessage(null);
        setIsSent(true);
      },
      onError: (error) => {
        setIsSent(false);
        setErrorMessage(error.message);
      },
    }),
  );

  function onSubmit(data: SendEmailFormValues) {
    setIsSent(false);
    setErrorMessage(null);
    sendEmail({ contactId, subject: data.subject, content: data.content });
  }

  return (
    <section className="p-4 md:p-20 bg-white mt-8">
      <h2>Envoyer un message</h2>

      {isSent && (
        <Alert
          className="mt-6"
          severity="success"
          role="status"
          title="Le message a bien été envoyé."
        />
      )}

      {errorMessage && (
        <Alert
          className="mt-6"
          severity="error"
          role="alert"
          title="Le message n'a pas été envoyé."
          description={errorMessage}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col">
        <Controller
          control={control}
          name="subject"
          render={({ field, fieldState }) => (
            <Input
              id="contact-email-subject"
              label="Objet"
              state={fieldState.error ? "error" : "default"}
              stateRelatedMessage={fieldState.error?.message}
              nativeInputProps={{
                "aria-required": true,
                value: field.value,
                onChange: (e) => field.onChange(e.target.value),
              }}
            />
          )}
        />

        <Controller
          control={control}
          name="content"
          render={({ field, fieldState }) => (
            <Input
              id="contact-email-content"
              label="Message"
              textArea
              state={fieldState.error ? "error" : "default"}
              stateRelatedMessage={fieldState.error?.message}
              nativeTextAreaProps={{
                "aria-required": true,
                rows: 8,
                value: field.value,
                onChange: (e) => field.onChange(e.target.value),
              }}
            />
          )}
        />

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={isPending}>
            Envoyer le message
          </Button>
        </div>
      </form>
    </section>
  );
}
