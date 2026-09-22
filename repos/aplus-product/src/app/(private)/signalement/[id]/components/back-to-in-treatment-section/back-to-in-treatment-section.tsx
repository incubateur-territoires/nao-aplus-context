"use client";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { useScrollToLastMessage } from "@/app/hooks/use-scroll-to-last-message";
import { useUploadFiles } from "@/app/query/file/file.query";
import { InputFile } from "@/app/component/ui/input-file/input-file";
import { ReportStatus } from "@/generated/prisma/enums";
import { USER_ROLES } from "@/constants/user-roles";
import { useTRPC } from "@/trpc/client";
import { AppRouter } from "@/trpc/routers/_app";
import { createTRPCPredicate } from "@/utils/query-invalidation";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inferRouterOutputs } from "@trpc/server";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const Schema = z.object({
  message: z.string().min(1, "Veuillez saisir un message."),
  files: z.array(z.instanceof(File)),
});

type FormValues = z.infer<typeof Schema>;

export function BackToInTreatmentSection({
  initialReport,
}: {
  initialReport: inferRouterOutputs<AppRouter>["report"]["getReportById"];
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { scrollToLastMessage } = useScrollToLastMessage({ reportId: id });
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: report } = useQuery({
    ...trpc.report.getReportById.queryOptions(id),
    initialData: initialReport,
  });

  const authorsIds = useMemo(
    () => [
      report?.authorId,
      ...(report?.coAuthors?.map((coAuthor) => coAuthor.id) ?? []),
    ],
    [report],
  );
  const isAuthorOrCoAuthor = authorsIds.includes(currentUserId ?? "");
  const isAdmin = session?.user?.role === USER_ROLES.ADMIN;
  const isCompleted = report?.status === ReportStatus.COMPLETED;
  const isClosed = report?.status === ReportStatus.CLOSED;
  const isApplicantTeamDeleted = !!report?.applicantTeam?.deletedAt;

  // Le bloc s'affiche pour repasser un signalement En cours de traitement :
  // - depuis Traité : auteur ou co-auteur ;
  // - depuis Fermé (remplace l'ancien bloc "Rouvrir le signalement") : auteur,
  //   co-auteur ou admin.
  const canSubmit =
    (isCompleted && isAuthorOrCoAuthor) ||
    (isClosed && (isAuthorOrCoAuthor || isAdmin));

  const { mutateAsync: uploadFiles, isPending: isUploadingFiles } =
    useUploadFiles();

  const { mutateAsync: createAnswer, isPending: isCreatingAnswer } =
    useMutation(
      trpc.answer.createAnswer.mutationOptions({
        onSuccess: (data) => {
          if (!data.success) {
            setApiError(data.message || "Une erreur est survenue");
            return;
          }
          setApiError(null);
          queryClient.invalidateQueries(
            trpc.report.getReportById.queryOptions(id),
          );
          queryClient.invalidateQueries(
            trpc.answer.getAnswersWithStatusHistory.queryOptions(id),
          );
          queryClient.invalidateQueries({
            predicate: createTRPCPredicate("report", [
              "getMyCreatedReportsTable",
              "getMyRequestedReportsTable",
            ]),
          });
          scrollToLastMessage();
          form.reset();
        },
        onError: (error) => {
          setApiError(error.message || "Une erreur est survenue");
        },
      }),
    );

  const form = useForm<FormValues>({
    defaultValues: { message: "", files: [] },
    resolver: zodResolver(Schema),
  });

  async function onSubmit(values: FormValues) {
    setApiError(null);
    let uploadedFiles: Array<{
      id: string;
      name: string;
      size: number;
      type: string;
      lastModified: Date;
    }> = [];

    if (values.files.length > 0) {
      const uploadResult = await uploadFiles(values.files);
      if (!uploadResult.ok) {
        setApiError(
          uploadResult.message || "Erreur lors du téléchargement des fichiers",
        );
        return;
      }
      uploadedFiles = uploadResult.data.map((f) => ({
        ...f,
        lastModified: new Date(f.lastModified),
      }));
    }

    try {
      await createAnswer({
        reportId: id,
        content: values.message,
        files: uploadedFiles,
        // Depuis un signalement fermé, le serveur résout le statut cible
        // (En attente de prise en charge ou En cours de traitement) ;
        // depuis Traité, on repasse directement En cours de traitement.
        ...(isClosed
          ? { reopenFromClosed: true }
          : { newReportStatus: ReportStatus.IN_TREATMENT }),
      });
    } catch {
      // onError callback already handled the error via setApiError
    }
  }

  if (!canSubmit || isApplicantTeamDeleted) {
    return null;
  }

  const isSubmitting = isCreatingAnswer || isUploadingFiles;

  return (
    <div className="bg-white p-20 flex flex-col gap-6 mt-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-[32px] font-bold leading-[40px] text-[#161616] m-0">
          Repasser le signalement En cours de traitement
        </h2>
        <p className="text-[16px] leading-[24px] text-[#3a3a3a] m-0">
          Le blocage du citoyen n&apos;est pas résolu.
          {isClosed && (
            <>
              <br />
              Remarque : si le signalement était «&nbsp;en attente de prise en
              charge&nbsp;», il reviendra à cet état.
            </>
          )}
        </p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Controller
          control={form.control}
          name="message"
          render={({ field }) => (
            <Input
              textArea
              label="Votre message (obligatoire) :"
              state={form.formState.errors.message ? "error" : "default"}
              stateRelatedMessage={form.formState.errors.message?.message || ""}
              nativeTextAreaProps={{
                value: field.value,
                rows: 5,
                onChange: (e) => field.onChange(e.target.value),
              }}
            />
          )}
        />
        <Controller
          control={form.control}
          name="files"
          render={({ field }) => (
            <InputFile {...field} name="input-file-back-to-in-treatment" />
          )}
        />
        {apiError && <p className="text-[#ce0500] text-sm mt-2">{apiError}</p>}
        <div className="flex justify-end mt-6">
          <Button size="large" disabled={isSubmitting} type="submit">
            Repasser le signalement En cours de traitement
          </Button>
        </div>
      </form>
    </div>
  );
}
