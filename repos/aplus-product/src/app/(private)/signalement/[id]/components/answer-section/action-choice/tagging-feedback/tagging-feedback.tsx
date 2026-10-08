"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { Tag } from "@codegouvfr/react-dsfr/Tag";
import { useTRPC } from "@/trpc/client";
import type { TaggingAxis } from "@/utils/tagging-feedback";

const AXIS_LEGEND: Record<TaggingAxis, string> = {
  procedure: "Démarche du citoyen",
  blockage: "Blocage rencontré",
};

const VERDICT_OPTIONS = [
  {
    isCorrect: true,
    label: "Correct",
    iconId: "fr-icon-thumb-up-fill",
  },
  {
    isCorrect: false,
    label: "Incorrect",
    iconId: "fr-icon-thumb-down-fill",
  },
] as const;

const TAGGING_HELP_URL =
  "https://docs.aplus.beta.gouv.fr/notes-de-version-au-28-septembre-2026/tags-automatiques-beta";

const SMALL_BUTTON_CLASS =
  "inline-flex items-center gap-1 border border-solid border-[var(--border-default-grey)] bg-transparent px-2 py-1 text-xs leading-5 text-[var(--text-default-grey)] hover:bg-[var(--background-default-grey-active)]";

function capitalize(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function TaggingFeedback() {
  const { id: reportId } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryOptions = trpc.taggingFeedback.get.queryOptions({ reportId });
  const { data } = useQuery(queryOptions);
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isThanksClosed, setIsThanksClosed] = useState(false);

  const setVerdict = useMutation(
    trpc.taggingFeedback.setVerdict.mutationOptions({
      onMutate: async ({ axis, isCorrect }) => {
        await queryClient.cancelQueries({ queryKey: queryOptions.queryKey });
        const previous = queryClient.getQueryData(queryOptions.queryKey);
        queryClient.setQueryData(queryOptions.queryKey, (current) =>
          current
            ? {
                ...current,
                axes: current.axes.map((entry) =>
                  entry.axis === axis ? { ...entry, isCorrect } : entry,
                ),
              }
            : current,
        );
        return { previous };
      },
      onError: (_error, _input, context) => {
        queryClient.setQueryData(queryOptions.queryKey, context?.previous);
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: queryOptions.queryKey }),
    }),
  );

  const hide = useMutation(
    trpc.taggingFeedback.hide.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: queryOptions.queryKey }),
    }),
  );

  if (!data || isDismissed) {
    return null;
  }

  const isFullyEvaluated = data.axes.every((entry) => entry.isCorrect !== null);

  return (
    <div className="mb-6 flex flex-col gap-4">
      {hasVoted && isFullyEvaluated && !isThanksClosed && (
        <Alert
          severity="success"
          role="status"
          small={false}
          title="Merci de votre évaluation."
          closable
          onClose={() => setIsThanksClosed(true)}
        />
      )}
      <div className="relative flex flex-col gap-4 overflow-hidden bg-[var(--background-default-grey-hover)] p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[23px] -top-[23px] flex h-[85px] w-[85px] items-center justify-center"
        >
          <span className="flex h-5 w-[100px] shrink-0 -rotate-45 items-center justify-center bg-[var(--background-action-high-blue-france)] text-[10px] font-bold text-[var(--text-inverted-blue-france)]">
            BÊTA
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <p className="m-0 text-sm leading-6">
            <span className="sr-only">(bêta) </span>
            Les tags suivants ont été ajoutés au signalement. Dites-nous s’ils
            sont corrects ou incorrects.
          </p>
          <button
            type="button"
            className={SMALL_BUTTON_CLASS}
            onClick={() => setIsDismissed(true)}
          >
            Masquer
            <span
              aria-hidden="true"
              className="fr-icon-close-line fr-icon--sm text-[var(--text-action-high-blue-france)]"
            />
          </button>
        </div>

        {data.axes.map(({ axis, label, isCorrect }) => (
          <fieldset
            key={axis}
            className="m-0 flex flex-wrap items-center gap-6 border-0 p-0"
          >
            <legend className="sr-only">
              {AXIS_LEGEND[axis]} : {capitalize(label)}
            </legend>
            <div aria-hidden="true">
              <Tag className="m-0 bg-[var(--background-action-low-blue-france)] text-[var(--text-action-high-blue-france)]">
                {capitalize(label)}
              </Tag>
            </div>
            <div className="flex items-center gap-4 rounded-full border border-solid border-[var(--border-default-grey)] bg-[var(--background-default-grey)] px-3 py-1">
              {VERDICT_OPTIONS.map((option, index) => {
                const inputId = `tagging-feedback-${axis}-${option.label}`;
                return (
                  <div key={option.label} className="flex items-center gap-4">
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="h-5 w-px bg-[var(--border-default-grey)]"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <div className="fr-radio-group fr-radio-group--sm">
                        <input
                          type="radio"
                          id={inputId}
                          name={`tagging-feedback-${axis}`}
                          checked={isCorrect === option.isCorrect}
                          onChange={() => {
                            setHasVoted(true);
                            setIsThanksClosed(false);
                            setVerdict.mutate({
                              taggingId: data.taggingId,
                              axis,
                              isCorrect: option.isCorrect,
                            });
                          }}
                        />
                        <label
                          className="fr-label text-sm leading-6"
                          htmlFor={inputId}
                        >
                          {option.label}
                        </label>
                      </div>
                      <span
                        aria-hidden="true"
                        className={`${option.iconId} fr-icon--sm text-[var(--text-action-high-blue-france)]`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="flex gap-4 pt-2">
          <button
            type="button"
            className={SMALL_BUTTON_CLASS}
            disabled={hide.isPending}
            onClick={() => hide.mutate()}
          >
            Ne plus jamais afficher ce bloc
            <span
              aria-hidden="true"
              className="fr-icon-close-line fr-icon--sm text-[var(--text-action-high-blue-france)]"
            />
          </button>
          <a
            href={TAGGING_HELP_URL}
            target="_blank"
            rel="noopener"
            className="self-center text-xs leading-5 text-[var(--text-default-grey)]"
          >
            En savoir + sur les tags automatiques (bêta)
            <span className="sr-only"> - nouvelle fenêtre</span>
          </a>
        </div>
      </div>
    </div>
  );
}
