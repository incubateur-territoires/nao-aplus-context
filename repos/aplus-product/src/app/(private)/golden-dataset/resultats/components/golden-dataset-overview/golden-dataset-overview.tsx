"use client";

import { useState, type FormEvent } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import Table from "@codegouvfr/react-dsfr/Table";
import Tag from "@codegouvfr/react-dsfr/Tag";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  ITEM_GROUPS,
  itemGroup,
  type ItemGroup,
} from "@/utils/golden-dataset-adjudication";
import { computeAgreement } from "@/utils/golden-dataset-agreement";
import { buildAnnotatorLabels } from "@/utils/golden-dataset-annotator-label";
import {
  buildOverviewSources,
  buildRunLabels,
  type OverviewSource,
} from "@/utils/golden-dataset-overview-sources";
import { summarizeOverview } from "@/utils/golden-dataset-overview-summary";
import {
  GOLDEN_TAG_AXES,
  toggleGoldenTag,
  type GoldenTagAxis,
  type GoldenTags,
} from "@/utils/golden-dataset-golden-tags";
import {
  sameTag,
  UNDETERMINED_GOLDEN_TAG,
  validateAnnotationTag,
} from "@/utils/golden-dataset-tag";
import { formatPercentage } from "@/utils/stats-percentage";

const MISSING_TAG = "–";
const MODEL_ICON = "fr-icon-cpu-line";
const MODEL_MARKER = "modèle";
const CHOOSE_TAG = "Retenir ce tag";
const UNCHOOSE_TAG = "Ne plus retenir ce tag";
const REFERENCE_LABEL = "Référence";
const RETAIN_ACTION = "Retenir";
const AGREEMENT_TITLE = "Accord entre annotateurs";

const AXIS_LABELS: Record<GoldenTagAxis, string> = {
  blockageTag: "Blocage",
  procedureTag: "Démarche",
};

const RETAIN_LABELS: Record<GoldenTagAxis, string> = {
  blockageTag: "Retenir un autre tag de blocage",
  procedureTag: "Retenir un autre tag de démarche",
};

const TAG_HEADERS = ["", ...GOLDEN_TAG_AXES.map((axis) => AXIS_LABELS[axis])];

const ITEM_FILTERS = [
  { group: ITEM_GROUPS.TO_DISCUSS, label: "À discuter" },
  { group: ITEM_GROUPS.UNANIMOUS, label: "Unanimes" },
  { group: ITEM_GROUPS.ADJUDICATED, label: "Adjugés" },
  { group: null, label: "Tous" },
] as const;

// Un tag replié sur deux lignes creuse un écart de hauteur entre les lignes
// voisines, et deux sources ne se comparent plus d'un coup d'œil.
const NO_WRAP = "whitespace-nowrap";

interface SourceTags {
  blockageTag: string | null;
  procedureTag: string | null;
}

interface OverviewAnnotation extends SourceTags {
  annotatorId: string;
}

interface OverviewPrediction extends SourceTags {
  runId: string;
}

export interface OverviewAnnotator {
  annotatorId: string;
  firstName: string;
  lastName: string;
  annotated: number;
}

export interface OverviewRun {
  runId: string;
  model: string;
  temperature: number;
  predicted: number;
}

export interface OverviewItem {
  position: number;
  organization: string;
  subject: string;
  description: string;
  goldenBlockageTag: string | null;
  goldenProcedureTag: string | null;
  annotations: OverviewAnnotation[];
  predictions: OverviewPrediction[];
}

function renderSourceLabel(source: OverviewSource) {
  if (source.kind === "human") {
    return (
      <strong key={source.key} className={NO_WRAP}>
        {source.label}
      </strong>
    );
  }

  return (
    <strong key={source.key} className={NO_WRAP}>
      {source.label}
      <span className="block text-xs font-normal text-[#666]">
        {MODEL_MARKER}
      </span>
    </strong>
  );
}

function formatRate(agreed: number, compared: number): string {
  return `${formatPercentage(agreed, compared)} (${agreed}/${compared})`;
}

interface ChoosableTagProps {
  tag: string;
  kind?: OverviewSource["kind"];
  retained: boolean;
  onChoose: () => void;
}

/**
 * `nativeButtonProps` est ce qui fait du tag DSFR un `<button>` ; sans lui, le
 * composant ignore `pressed` et rend un `<p>`. L'état retenu se lit alors dans
 * `aria-pressed`, que la feuille de style DSFR habille déjà.
 */
function ChoosableTag({ tag, kind, retained, onChoose }: ChoosableTagProps) {
  const shared = {
    className: NO_WRAP,
    pressed: retained,
    title: retained ? UNCHOOSE_TAG : CHOOSE_TAG,
    nativeButtonProps: { type: "button" as const, onClick: onChoose },
  };

  if (kind === "model") {
    return (
      <Tag small iconId={MODEL_ICON} {...shared}>
        {tag}
      </Tag>
    );
  }

  return <Tag {...shared}>{tag}</Tag>;
}

interface RetainTagFormProps {
  axis: GoldenTagAxis;
  retained: GoldenTags;
  onRetain: (chosen: GoldenTags) => void;
}

/**
 * La saisie retient sans jamais basculer : réécrire le texte déjà retenu doit
 * le confirmer et non le relâcher, sans quoi valider un formulaire effacerait
 * la référence.
 */
function RetainTagForm({ axis, retained, onRetain }: RetainTagFormProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateAnnotationTag(text);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    if (validation.value === null) {
      return;
    }

    onRetain({ ...retained, [axis]: validation.value });
    setText("");
    setError(null);
  }

  return (
    <form className="flex items-start gap-2" onSubmit={submit}>
      <Input
        className="m-0 w-40"
        label={RETAIN_LABELS[axis]}
        classes={{ label: "fr-sr-only" }}
        state={error === null ? "default" : "error"}
        stateRelatedMessage={error ?? undefined}
        nativeInputProps={{
          value: text,
          onChange: (event) => setText(event.target.value),
        }}
      />
      <Button type="submit" priority="secondary" size="small">
        {RETAIN_ACTION}
      </Button>
    </form>
  );
}

export function GoldenDatasetOverview() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(
    trpc.goldenDataset.overview.queryOptions(),
  );
  const overviewKey = trpc.goldenDataset.overview.queryKey();
  const [activeFilter, setActiveFilter] = useState<ItemGroup | null>(null);

  const chooseGoldenTags = useMutation(
    trpc.goldenDataset.chooseGoldenTags.mutationOptions({
      // Chaque appel porte l'état complet des deux axes : deux appels en vol
      // en même temps peuvent commiter dans le désordre côté serveur, et le
      // premier clic écrase alors le second (observé : un POST à 3,6 s commité
      // après le suivant). Le scope fait exécuter les mutations une par une.
      scope: { id: "golden-dataset-choose-golden-tags" },
      onMutate: async (chosen) => {
        // La requête recharge tout le corpus : l'invalider à chaque clic
        // rendrait la page inutilisable, et la réponse du serveur n'apprend
        // rien que l'entrée n'ait déjà. Le cache est donc écrit sur place, et
        // un refetch en vol est annulé pour qu'il n'écrase pas cette écriture.
        await queryClient.cancelQueries({ queryKey: overviewKey });
        const previous = queryClient.getQueryData(overviewKey);

        queryClient.setQueryData(overviewKey, (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.position === chosen.position
                    ? {
                        ...item,
                        goldenBlockageTag: chosen.blockageTag ?? null,
                        goldenProcedureTag: chosen.procedureTag ?? null,
                      }
                    : item,
                ),
              }
            : current,
        );

        return { previous };
      },
      onError: (_error, _chosen, context) => {
        if (context?.previous) {
          queryClient.setQueryData(overviewKey, context.previous);
        }
      },
    }),
  );

  const adjudicateUnanimous = useMutation(
    trpc.goldenDataset.adjudicateUnanimous.mutationOptions({
      // Contrairement à `chooseGoldenTags`, dont l'entrée dit déjà tout ce que
      // l'écriture produira, celle-ci touche potentiellement tout le corpus
      // sans dire quels items. Rejouer la requête est la seule façon
      // d'afficher ce qui a réellement été écrit.
      onSuccess: () => queryClient.invalidateQueries({ queryKey: overviewKey }),
    }),
  );

  if (isLoading) {
    return <p>Chargement des annotations…</p>;
  }

  if (error) {
    return <p role="alert">{error.message}</p>;
  }

  if (!data || data.items.length === 0) {
    return <p>Aucun signalement dans le corpus.</p>;
  }

  const { total, annotators, runs, items } = data;
  const namedAnnotators = annotators.map((annotator) => ({
    id: annotator.annotatorId,
    firstName: annotator.firstName,
    lastName: annotator.lastName,
  }));
  const annotatorLabels = buildAnnotatorLabels(namedAnnotators);
  const runLabels = buildRunLabels(runs);
  const sources = buildOverviewSources(namedAnnotators, runs);
  const summary = summarizeOverview(items);
  const agreement = computeAgreement(items);
  const comparedAxes = GOLDEN_TAG_AXES.filter(
    (axis) => agreement[axis].compared > 0,
  );
  const visibleItems = items.filter(
    (item) => activeFilter === null || itemGroup(item) === activeFilter,
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="m-0 text-xl">Avancement</h2>
        <ul className="m-0 mt-3 flex flex-wrap list-none gap-x-8 gap-y-1 p-0 text-sm">
          {annotators.map((annotator) => (
            <li key={annotator.annotatorId} className="flex gap-2">
              <span className="font-bold">
                {annotatorLabels.get(annotator.annotatorId)}
              </span>
              <span className="text-[#666]">{`${annotator.annotated}/${total}`}</span>
            </li>
          ))}
        </ul>
        {runs.length > 0 && (
          <ul className="m-0 mt-2 flex flex-wrap list-none gap-x-8 gap-y-1 border-t border-[#DDDDDD] border-solid p-0 pt-2 text-sm">
            {runs.map((run) => (
              <li key={run.runId} className="flex gap-2">
                <span className="text-[#666]">{MODEL_MARKER}</span>
                <span className="font-bold">{runLabels.get(run.runId)}</span>
                <span className="text-[#666]">{`${run.predicted}/${total}`}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 mt-2 border-t border-[#DDDDDD] border-solid pt-2 text-sm">
          <span className="font-bold">Adjugés</span>{" "}
          <span className="text-[#666]">{`${summary.groups[ITEM_GROUPS.ADJUDICATED]}/${total}`}</span>
        </p>
        {comparedAxes.length > 0 && (
          <section className="mt-2 border-t border-[#DDDDDD] border-solid pt-2">
            <h3 className="m-0 text-base">{AGREEMENT_TITLE}</h3>
            <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-sm">
              {comparedAxes.map((axis) => (
                <li key={axis}>
                  <p className="m-0 flex gap-2">
                    <span className="font-bold">{AXIS_LABELS[axis]}</span>
                    <span className="text-[#666]">
                      {formatRate(
                        agreement[axis].agreed,
                        agreement[axis].compared,
                      )}
                    </span>
                  </p>
                  <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0 pl-4 text-[#666]">
                    {agreement[axis].pairs
                      .filter((pair) => pair.compared > 0)
                      .map((pair) => (
                        <li key={`${pair.a}-${pair.b}`} className="flex gap-2">
                          <span>{`${annotatorLabels.get(pair.a)} · ${annotatorLabels.get(pair.b)}`}</span>
                          <span>{formatRate(pair.agreed, pair.compared)}</span>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ul className="fr-tags-group m-0 p-0">
            {ITEM_FILTERS.map((filter) => (
              <li key={filter.label}>
                <Tag
                  pressed={activeFilter === filter.group}
                  nativeButtonProps={{
                    type: "button",
                    onClick: () => setActiveFilter(filter.group),
                  }}
                >
                  {`${filter.label} (${filter.group === null ? items.length : summary.groups[filter.group]})`}
                </Tag>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            priority="secondary"
            disabled={
              summary.pendingUnanimousAxes === 0 ||
              adjudicateUnanimous.isPending
            }
            onClick={() => adjudicateUnanimous.mutate()}
          >
            {`Retenir les ${summary.pendingUnanimousAxes} unanimes`}
          </Button>
        </div>
        {adjudicateUnanimous.error && (
          <p role="alert" className="fr-error-text m-0">
            {`Le remplissage a échoué. ${adjudicateUnanimous.error.message}`}
          </p>
        )}
      </div>

      <ul className="m-0 flex list-none flex-col gap-6 p-0">
        {visibleItems.map((item) => {
          // Humains et modèles se rejoignent ici et nulle part ailleurs. Leurs
          // identifiants viennent de deux tables sans lien, donc ils ne se
          // croisent pas et une seule table de correspondance sert aux deux
          // sortes. Une source sans entrée dit d'elle-même qu'elle n'a pas
          // traité ce signalement.
          const tagsBySource = new Map<string, SourceTags>();
          for (const annotation of item.annotations) {
            tagsBySource.set(annotation.annotatorId, annotation);
          }
          for (const prediction of item.predictions) {
            tagsBySource.set(prediction.runId, prediction);
          }

          const retained: GoldenTags = {
            blockageTag: item.goldenBlockageTag,
            procedureTag: item.goldenProcedureTag,
          };

          function chooseTags(chosen: GoldenTags) {
            chooseGoldenTags.mutate({ position: item.position, ...chosen });
          }

          // Le retenu se reconnaît à l'équivalence de son texte : toutes les
          // sources qui ont écrit ce texte, à la casse ou aux accents près,
          // s'affichent pressées sur cet axe.
          function renderAxis(axis: GoldenTagAxis, source: OverviewSource) {
            const tag = tagsBySource.get(source.key)?.[axis];

            if (!tag || tag.trim().length === 0) {
              return <span className="text-[#929292]">{MISSING_TAG}</span>;
            }

            return (
              <ChoosableTag
                tag={tag}
                kind={source.kind}
                retained={sameTag(retained[axis], tag)}
                onChoose={() =>
                  chooseTags(toggleGoldenTag(retained, axis, tag))
                }
              />
            );
          }

          function renderReferenceAxis(axis: GoldenTagAxis) {
            const tag = retained[axis];
            const isUndetermined = sameTag(tag, UNDETERMINED_GOLDEN_TAG);

            return (
              <div className="flex flex-wrap items-start gap-2">
                {/* « inconnu » a déjà son bouton juste à côté : l'afficher
                    aussi ici doublerait le même tag dans la cellule. */}
                {tag !== null && !isUndetermined && (
                  <ChoosableTag
                    tag={tag}
                    retained
                    onChoose={() =>
                      chooseTags(toggleGoldenTag(retained, axis, tag))
                    }
                  />
                )}
                <ChoosableTag
                  tag={UNDETERMINED_GOLDEN_TAG}
                  retained={isUndetermined}
                  onChoose={() =>
                    chooseTags(
                      toggleGoldenTag(retained, axis, UNDETERMINED_GOLDEN_TAG),
                    )
                  }
                />
                <RetainTagForm
                  axis={axis}
                  retained={retained}
                  onRetain={chooseTags}
                />
              </div>
            );
          }

          return (
            <li
              key={item.position}
              className="border border-[#DDDDDD] border-solid"
            >
              <article className="flex flex-col gap-4 p-6">
                <div>
                  <p className="m-0 text-sm text-[#666]">
                    {`Signalement ${item.position} / ${total} · ${item.organization}`}
                  </p>
                  <h3 className="mt-1 mb-3 text-lg">{item.subject}</h3>
                  <p className="m-0 max-w-[70ch] text-sm whitespace-pre-line">
                    {item.description}
                  </p>
                </div>

                <Table
                  noCaption
                  bordered
                  className="m-0"
                  caption={`Annotations et prédictions du signalement ${item.position}`}
                  headers={TAG_HEADERS}
                  data={[
                    ...sources.map((source) => [
                      renderSourceLabel(source),
                      ...GOLDEN_TAG_AXES.map((axis) =>
                        renderAxis(axis, source),
                      ),
                    ]),
                    [
                      <strong key={REFERENCE_LABEL} className={NO_WRAP}>
                        {REFERENCE_LABEL}
                      </strong>,
                      ...GOLDEN_TAG_AXES.map((axis) =>
                        renderReferenceAxis(axis),
                      ),
                    ],
                  ]}
                />
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
