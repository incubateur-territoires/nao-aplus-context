"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import Input from "@codegouvfr/react-dsfr/Input";
import { useTRPC } from "@/trpc/client";
import { ROUTE } from "@/app/constant/route";
import { validateAnnotationTag } from "@/utils/golden-dataset-tag";
import { buildAnnotatorLabels } from "@/utils/golden-dataset-annotator-label";

function parsePosition(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

// Reproduit la normalisation que le serveur applique à l'enregistrement, pour
// que l'entrée écrite dans le cache soit exactement ce qu'un refetch renverrait.
function toSavedTag(raw: string): string | null {
  const validation = validateAnnotationTag(raw);
  return validation.ok ? validation.value : null;
}

export function GoldenDatasetAnnotator() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPosition = parsePosition(searchParams.get("n"));

  const { data, error } = useQuery({
    ...trpc.goldenDataset.getItem.queryOptions({ position: requestedPosition }),
    placeholderData: keepPreviousData,
  });
  const saveAnnotation = useMutation(
    trpc.goldenDataset.saveAnnotation.mutationOptions(),
  );

  const [syncedPosition, setSyncedPosition] = useState<number | null>(null);
  const [blockageTag, setBlockageTag] = useState("");
  const [procedureTag, setProcedureTag] = useState("");
  const blockageInputRef = useRef<HTMLInputElement>(null);

  // Dérivation pendant le rendu plutôt qu'une `key` sur un sous-composant : un
  // seul composant à maintenir, et un refetch de la même position (retour de
  // focus sur la fenêtre) n'écrase pas une saisie en cours.
  if (data && syncedPosition !== data.position) {
    setSyncedPosition(data.position);
    setBlockageTag(data.annotation?.blockageTag ?? "");
    setProcedureTag(data.annotation?.procedureTag ?? "");
  }

  // Dépendance sur la position et non sur chaque rendu : le composant reste
  // monté d'un signalement à l'autre, et une saisie en cours ne doit pas se
  // faire reprendre le focus.
  useEffect(() => {
    blockageInputRef.current?.focus();
  }, [syncedPosition]);

  const displayedPosition = data?.position;
  const totalPositions = data?.total;

  // Précharge les voisins dès l'arrivée d'un signalement : combiné à
  // keepPreviousData, « Suivant » et « Précédent » affichent leur cible sans
  // repasser par un état de chargement.
  useEffect(() => {
    if (displayedPosition === undefined || totalPositions === undefined) {
      return;
    }
    for (const neighbor of [displayedPosition - 1, displayedPosition + 1]) {
      if (neighbor >= 1 && neighbor <= totalPositions) {
        void queryClient.prefetchQuery(
          trpc.goldenDataset.getItem.queryOptions({ position: neighbor }),
        );
      }
    }
  }, [displayedPosition, totalPositions, queryClient, trpc]);

  const blockageValidation = validateAnnotationTag(blockageTag);
  const procedureValidation = validateAnnotationTag(procedureTag);
  const canNavigate = blockageValidation.ok && procedureValidation.ok;

  if (error) {
    return (
      <p role="alert" className="fr-error-text">
        {error.message}
      </p>
    );
  }

  // Seule l'absence de toute donnée vide l'écran : entre deux positions,
  // keepPreviousData garde le signalement précédent affiché.
  if (!data) {
    return <p>Chargement du signalement…</p>;
  }

  // La position affichée vient des données, pas de l'URL : pendant un
  // chargement, l'URL pointe déjà la cible alors que la carte montre encore la
  // position précédente. En-tête, bornes et enregistrement suivent la carte.
  const { total, position, item, progress, currentAnnotatorId } = data;
  const isLastPosition = position >= total;
  const annotatorLabels = buildAnnotatorLabels(
    progress.map((entry) => ({
      id: entry.annotatorId,
      firstName: entry.firstName,
      lastName: entry.lastName,
    })),
  );

  function saveCurrentAnnotation(onSaved?: () => void) {
    saveAnnotation.mutate(
      { position, blockageTag, procedureTag },
      {
        onSuccess: () => {
          // Sans cette écriture, un retour arrière du navigateur resservirait
          // la réponse mise en cache avant l'enregistrement : champs vides,
          // que le clic suivant réenregistrerait par-dessus l'annotation
          // réelle. Les compteurs de progression des entrées en cache restent
          // périmés jusqu'à leur refetch au montage suivant.
          queryClient.setQueryData(
            trpc.goldenDataset.getItem.queryKey({ position }),
            (previous) =>
              previous && {
                ...previous,
                annotation: {
                  blockageTag: toSavedTag(blockageTag),
                  procedureTag: toSavedTag(procedureTag),
                },
              },
          );
          onSaved?.();
        },
      },
    );
  }

  function goToPosition(nextPosition: number) {
    if (!canNavigate) {
      return;
    }

    // La navigation n'attend pas l'écriture : position et tags sont capturés
    // par la fermeture de ce rendu, l'upsert serveur est idempotent, et un
    // échec reste visible via saveAnnotation.error puisque le composant reste
    // monté d'une position à l'autre.
    saveCurrentAnnotation();

    // Seul un paramètre de requête change : pushState, que Next prend en
    // charge depuis la 14.1, met à jour useSearchParams sans rejouer le
    // Server Component de la page.
    window.history.pushState(
      null,
      "",
      `${ROUTE.GOLDEN_DATASET}?n=${nextPosition}`,
    );
  }

  // Dernière position : il n'y a pas de « Suivant » où l'enregistrement se
  // ferait au passage, l'annotation resterait donc perdue. Contrairement à la
  // navigation entre signalements, on attend la confirmation du serveur : la
  // restitution relit les annotations côté serveur, et y arriver avant
  // l'écriture afficherait un corpus incomplet.
  function submitLastAnnotation() {
    if (!canNavigate) {
      return;
    }

    saveCurrentAnnotation(() => {
      router.push(ROUTE.GOLDEN_DATASET_RESULTS);
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="m-0 text-2xl font-bold">{`Signalement ${position} / ${total}`}</p>
        <ul className="m-0 mt-3 flex max-w-xs list-none flex-col gap-1 p-0 text-sm text-[#666]">
          {progress.map((entry) => (
            <li key={entry.annotatorId} className="flex justify-between gap-6">
              {entry.annotatorId === currentAnnotatorId ? (
                <strong>{annotatorLabels.get(entry.annotatorId)}</strong>
              ) : (
                <span>{annotatorLabels.get(entry.annotatorId)}</span>
              )}
              <span>{`${entry.annotated}/${total}`}</span>
            </li>
          ))}
        </ul>
      </div>

      <hr className="m-0" />

      {/* Hauteur minimale calibrée sur la description médiane du corpus
          (~440 caractères sur ~8 lignes à 70ch), pour que les boutons ne
          sautent pas verticalement d'un signalement à l'autre. */}
      <article className="min-h-[20rem] border border-[#DDDDDD] border-solid p-6">
        <p className="m-0 text-sm text-[#666]">{item.organization}</p>
        <h2 className="mt-1 mb-4 text-xl">{item.subject}</h2>
        <p className="m-0 max-w-[70ch] whitespace-pre-line">
          {item.description}
        </p>
      </article>

      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-xl">Votre annotation</h2>
        <div className="flex flex-col gap-2 md:flex-row md:gap-6">
          <Input
            className="flex-1"
            label="Tag blocage"
            hintText="Ex. : compte inactif, retard, bug informatique"
            state={blockageValidation.ok ? "default" : "error"}
            stateRelatedMessage={
              blockageValidation.ok ? undefined : blockageValidation.error
            }
            nativeInputProps={{
              ref: blockageInputRef,
              value: blockageTag,
              onChange: (event) => setBlockageTag(event.target.value),
            }}
          />
          <Input
            className="flex-1"
            label="Tag démarche"
            hintText="Ex. : demande de RSA, perte de carte d'identité"
            state={procedureValidation.ok ? "default" : "error"}
            stateRelatedMessage={
              procedureValidation.ok ? undefined : procedureValidation.error
            }
            nativeInputProps={{
              value: procedureTag,
              onChange: (event) => setProcedureTag(event.target.value),
            }}
          />
        </div>

        {saveAnnotation.error && (
          <p role="alert" className="fr-error-text m-0">
            {`L'enregistrement a échoué. ${saveAnnotation.error.message}`}
          </p>
        )}

        <ButtonsGroup
          className="m-0"
          alignment="between"
          buttonsEquisized
          buttonsSize="large"
          inlineLayoutWhen="md and up"
          buttons={[
            {
              children: "Précédent",
              type: "button",
              priority: "secondary",
              disabled: position <= 1 || saveAnnotation.isPending,
              onClick: () => {
                goToPosition(position - 1);
              },
            },
            isLastPosition
              ? {
                  children: "Enregistrer mon annotation",
                  type: "button",
                  disabled: saveAnnotation.isPending,
                  onClick: submitLastAnnotation,
                }
              : {
                  children: "Suivant",
                  type: "button",
                  disabled: saveAnnotation.isPending,
                  onClick: () => {
                    goToPosition(position + 1);
                  },
                },
          ]}
        />

        {saveAnnotation.isPending && (
          <p className="m-0 text-sm text-[#666]">Enregistrement…</p>
        )}
      </div>

      {isLastPosition && (
        <>
          <hr className="m-0" />
          <p className="m-0">
            <Link className="fr-link" href={ROUTE.GOLDEN_DATASET_RESULTS}>
              Voir la restitution des annotations
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
