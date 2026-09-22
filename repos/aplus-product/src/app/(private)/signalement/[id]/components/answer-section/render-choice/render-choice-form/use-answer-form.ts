import { useUploadFiles } from "@/app/query/file/file.query";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import z from "zod";
import { ReportStatus } from "@/generated/prisma/enums";
import { ActionChoiceValue } from "../../action-choice/action-choice";
import { FormValues } from "./types";
import { useScrollToLastMessage } from "@/app/hooks/use-scroll-to-last-message";
import { createTRPCPredicate } from "@/utils/query-invalidation";

interface UseAnswerFormProps {
  resetSelectedChoice: () => void;
  defaultActionChoice?: ActionChoiceValue | null;
}

// Map action choice to request status
function mapActionChoiceToReportStatus(
  actionChoice: ActionChoiceValue | null,
): ReportStatus | undefined {
  if (!actionChoice) return undefined;

  const mapping: Partial<Record<ActionChoiceValue, ReportStatus>> = {
    [ActionChoiceValue.IN_TREATMENT]: ReportStatus.IN_TREATMENT,
    [ActionChoiceValue.COMPLETED]: ReportStatus.COMPLETED,
    [ActionChoiceValue.SEND_MESSAGE]: undefined,
    [ActionChoiceValue.INVITE]: undefined,
  };

  return mapping[actionChoice];
}

export function useAnswerForm({
  resetSelectedChoice,
  defaultActionChoice = null,
}: UseAnswerFormProps) {
  const Schema = z
    .object({
      message: z.string().optional(),
      files: z.array(z.instanceof(File)),
      isOperatorOnly: z.boolean(),
      isIrrelevant: z.boolean(),
      actionChoice: z.nativeEnum(ActionChoiceValue).nullable(),
    })
    .refine(
      (data) => {
        // Require message for all action choices except INVITE
        if (
          data.actionChoice &&
          data.actionChoice !== ActionChoiceValue.INVITE
        ) {
          return data.message && data.message.length >= 0;
        }
        return true;
      },
      {
        message: "Veuillez saisir un message.",
        path: ["message"],
      },
    )
    .refine((data) => data.actionChoice !== null, {
      message: "Veuillez sélectionner un type de réponse",
      path: ["actionChoice"],
    });

  const { id: reportId } = useParams() as { id: string };
  const trpc = useTRPC();
  const [apiError, setApiError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { scrollToLastMessage } = useScrollToLastMessage({ reportId });

  const formMethods = useForm<FormValues>({
    defaultValues: {
      message: "",
      files: [],
      isOperatorOnly: false,
      isIrrelevant: false,
      actionChoice: defaultActionChoice,
    },
    mode: "onSubmit",
    resolver: zodResolver(Schema),
  });

  const markAnswersAsViewedMutation = useMutation(
    trpc.answer.markAnswersAsViewed.mutationOptions(),
  );

  const {
    mutateAsync: createAnswer,
    isPending: isCreatingAnswer,
    isError,
    error,
  } = useMutation(
    trpc.answer.createAnswer.mutationOptions({
      onSuccess: async (data) => {
        if (data.success) {
          setApiError(null);

          // Mark all previous answers as viewed (user must have scrolled to bottom to post)
          const answersData = queryClient.getQueryData(
            trpc.answer.getAnswersWithStatusHistory.queryKey(reportId),
          );
          if (answersData?.answers) {
            const answerIds = answersData.answers.map((answer) => answer.id);
            if (answerIds.length > 0) {
              markAnswersAsViewedMutation.mutate({ answerIds });
            }
          }

          // getReportById et getAnswersWithStatusHistory sont rechargés par
          // scrollToLastMessage : les invalider ici en plus doublait le batch.
          // Invalidate report tables to update status in the list
          queryClient.invalidateQueries({
            predicate: createTRPCPredicate("report", [
              "getMyCreatedReportsTable",
              "getMyRequestedReportsTable",
            ]),
          });
          // Invalidate unread counts to update badges in the reports table
          queryClient.invalidateQueries({
            predicate: createTRPCPredicate(
              "answer",
              "getUnreadCountsByReports",
            ),
          });
          scrollToLastMessage();
          // Reset form after successful submission
          formMethods.reset();
          resetSelectedChoice();
        } else {
          setApiError(data.message || "Une erreur est survenue");
          console.error(data.message);
        }
      },
      onError: (error) => {
        setApiError(error.message || "Une erreur est survenue");
        console.error(error);
      },
    }),
  );

  const { mutateAsync: uploadFiles, isPending: isUploadingFiles } =
    useUploadFiles();

  async function onSubmit(data: FormValues) {
    setApiError(null);
    try {
      let filesWithDateObjects: Array<{
        id: string;
        name: string;
        size: number;
        type: string;
        lastModified: Date;
      }> = [];

      // Only upload files if there are any
      if (data.files && data.files.length > 0) {
        const uploadResult = await uploadFiles(data.files);

        if (!uploadResult.ok) {
          setApiError(
            uploadResult.message ||
              "Erreur lors du téléchargement des fichiers",
          );
          console.error(uploadResult.message);
          return;
        }

        filesWithDateObjects = uploadResult.data.map(
          (file: {
            id: string;
            name: string;
            size: number;
            type: string;
            lastModified: Date;
          }) => ({
            ...file,
            lastModified: new Date(file.lastModified),
          }),
        );
      }

      // Map actionChoice to newReportStatus
      const newReportStatus = mapActionChoiceToReportStatus(data.actionChoice);

      await createAnswer({
        newReportStatus,
        reportId: reportId,
        content: data.message || "",
        files: filesWithDateObjects,
        isOperatorOnly: data.isOperatorOnly,
        isIrrelevant: data.isIrrelevant,
      });
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue",
      );
      console.error("Submission error:", error);
    }
  }

  return {
    formMethods,
    onSubmit,
    isCreatingAnswer,
    isUploadingFiles,
    isError,
    error,
    apiError,
  };
}
