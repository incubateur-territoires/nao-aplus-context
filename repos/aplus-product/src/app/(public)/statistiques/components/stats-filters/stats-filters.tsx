"use client";

import { useEffect, useState } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import type { StatsFilters as StatsFiltersValues } from "@/trpc/routers/stats";
import { Spinner } from "@/app/component/spinner/spinner";
import {
  MultiSelectFilter,
  type MultiSelectOption,
} from "../multi-select-filter/multi-select-filter";

export interface StatsFilterOptions {
  areas: MultiSelectOption[];
  authorOrganizations: MultiSelectOption[];
  authorTeams: MultiSelectOption[];
  requestedOrganizations: MultiSelectOption[];
  requestedTeams: MultiSelectOption[];
}

interface StatsFiltersProps {
  /** Filtres courants (composant contrôlé — auto-application). */
  filters: StatsFiltersValues;
  options: StatsFilterOptions;
  /** Appelé à chaque changement de sélection : le parent applique aussitôt. */
  onChange: (filters: StatsFiltersValues) => void;
  /** Recalcul des options à facettes en cours (loader + annonce lecteur d'écran). */
  isLoadingOptions?: boolean;
}

// Vide → pas de filtre. Sinon on envoie la sélection telle quelle.
//
// ⚠️ On NE collapse PAS « toutes les options cochées » vers `undefined`. Avec le
// filtrage à facettes, chaque liste est déjà restreinte par les AUTRES filtres :
// si plusieurs dimensions n'affichent plus qu'une seule option compatible et
// qu'on les coche, elles se croiraient toutes « tout sélectionné » et
// renverraient `undefined` simultanément → plus aucun filtre → on retomberait
// sur le total NON filtré. On envoie donc toujours les ids explicitement.
function toFilterValue(ids: string[]): string[] | undefined {
  return ids.length === 0 ? undefined : ids;
}

// Deux champs d'une même famille par ligne (le tiroir occupe les deux tiers de
// l'écran), repliés en colonne sur les écrans étroits. `items-start` évite que
// les champs s'étirent quand l'un porte plus de tags de sélection que l'autre.
//
// La ligne est plafonnée, sans quoi les champs s'étireraient avec le tiroir
// (jusqu'à ~560px sur grand écran). Ailleurs dans l'app, un champ de saisie ne
// dépasse pas ~480px : export des signalements (`max-w-md`), recherche
// utilisateurs (`max-w-[480px]`), filtre équipes (`md:w-80`). 984px = deux
// colonnes de 480px + la gouttière de 24px.
const FIELD_ROW_CLASS = "grid max-w-[984px] items-start gap-6 md:grid-cols-2";

// Chaque champ réserve à sa droite la place du spinner de recalcul, affiché ou
// non : sans cette gouttière permanente, les champs changeraient de largeur
// d'une famille à l'autre et à chaque apparition du spinner.
const DATE_FIELD_CLASS = "flex items-end gap-2";
// `mb-2.5` (10px) recentre le spinner (20px) sur la hauteur de l'input (40px),
// le conteneur étant aligné sur le bas du champ.
const SPINNER_GUTTER_CLASS = "size-5 shrink-0 mb-2.5";

/** Dimensions multi-select des filtres (hors période). */
const MULTI_SELECT_KEYS = [
  "areaIds",
  "authorOrganizationIds",
  "authorTeamIds",
  "requestedOrganizationIds",
  "requestedTeamIds",
] as const;

/** Champ actionné en dernier — les deux dates comptent pour un seul champ. */
type FilterKey = (typeof MULTI_SELECT_KEYS)[number] | "period";

export function StatsFilters({
  filters,
  options,
  onChange,
  isLoadingOptions,
}: StatsFiltersProps) {
  const [lastChanged, setLastChanged] = useState<FilterKey | null>(null);

  // Élague les sélections devenues indisponibles quand les options se
  // restreignent (ex. on choisit l'org destinataire CARSAT → une équipe auteure
  // qui ne l'a jamais sollicitée disparaît de la liste et doit être désélectionnée).
  // On ne touche rien tant qu'aucune option n'est chargée (`length === 0`) pour
  // ne pas vider les sélections initiales (issues de l'URL) au premier rendu.
  // Garde anti-boucle : `onChange` n'est émis que si une sélection a réellement
  // changé (comparaison par référence, `pruneIds` renvoie `selected` tel quel
  // sinon) → l'exécution suivante de l'effet est un no-op.
  useEffect(() => {
    function pruneIds(
      available: MultiSelectOption[],
      selected: string[] | undefined,
    ): string[] | undefined {
      if (!selected || selected.length === 0 || available.length === 0) {
        return selected;
      }
      const availableIds = new Set(available.map((option) => option.id));
      const next = selected.filter((id) => availableIds.has(id));
      return next.length === selected.length ? selected : toFilterValue(next);
    }

    const pruned: StatsFiltersValues = {
      ...filters,
      areaIds: pruneIds(options.areas, filters.areaIds),
      authorOrganizationIds: pruneIds(
        options.authorOrganizations,
        filters.authorOrganizationIds,
      ),
      authorTeamIds: pruneIds(options.authorTeams, filters.authorTeamIds),
      requestedOrganizationIds: pruneIds(
        options.requestedOrganizations,
        filters.requestedOrganizationIds,
      ),
      requestedTeamIds: pruneIds(
        options.requestedTeams,
        filters.requestedTeamIds,
      ),
    };
    const hasChanged = MULTI_SELECT_KEYS.some(
      (key) => pruned[key] !== filters[key],
    );
    if (hasChanged) onChange(pruned);
  }, [options, filters, onChange]);

  const today = new Date().toISOString().split("T")[0];

  const startDate = filters.startDate ?? "";
  const endDate = filters.endDate ?? "";

  function update(key: FilterKey, partial: Partial<StatsFiltersValues>) {
    setLastChanged(key);
    onChange({ ...filters, ...partial });
  }

  // Le champ que l'utilisateur vient d'actionner ne porte pas de spinner :
  // l'indicateur est là pour montrer que ce choix recalcule les AUTRES filtres.
  // Au premier chargement (aucun champ actionné), tous en portent un.
  function isRecalculating(key: FilterKey) {
    return Boolean(isLoadingOptions) && lastChanged !== key;
  }

  return (
    <div
      className="flex w-full flex-col gap-14"
      aria-label="Filtres des statistiques"
    >
      <fieldset className="m-0 flex flex-col gap-6 border-0 p-0">
        <legend className="fr-h6 mb-0">Période</legend>
        {/* Champs d'une même famille côte à côte : limite le défilement du
            tiroir. Repli sur une colonne quand la largeur manque. */}
        <div className={FIELD_ROW_CLASS}>
          <div className={DATE_FIELD_CLASS}>
            <Input
              label="Date de début"
              hintText="Format : jj / mm / aaaa"
              // Neutralise la marge basse par défaut de `.fr-input-group` (24px) :
              // l'espacement vertical est entièrement géré par le `gap` du
              // conteneur, sinon on cumulerait les deux.
              className="mb-0! min-w-0 flex-1"
              nativeInputProps={{
                type: "date",
                max: endDate || today,
                value: startDate,
                onChange: (e) =>
                  update("period", { startDate: e.target.value || undefined }),
              }}
            />
            <div aria-hidden="true" className={SPINNER_GUTTER_CLASS}>
              {isRecalculating("period") && <Spinner />}
            </div>
          </div>
          <div className={DATE_FIELD_CLASS}>
            <Input
              label="Date de fin"
              hintText="Format : jj / mm / aaaa"
              className="mb-0! min-w-0 flex-1"
              nativeInputProps={{
                type: "date",
                max: today,
                min: startDate || undefined,
                value: endDate,
                onChange: (e) =>
                  update("period", { endDate: e.target.value || undefined }),
              }}
            />
            <div aria-hidden="true" className={SPINNER_GUTTER_CLASS}>
              {isRecalculating("period") && <Spinner />}
            </div>
          </div>
        </div>
        {(startDate || endDate) && (
          <Button
            type="button"
            priority="tertiary no outline"
            iconId="fr-icon-close-line"
            size="small"
            className="self-start"
            onClick={() =>
              update("period", { startDate: undefined, endDate: undefined })
            }
          >
            Effacer la période
          </Button>
        )}
      </fieldset>

      {/* Famille à champ unique : pas de `fieldset`/`legend` ici, contrairement
          aux familles voisines. Un groupe ne se justifie qu'à partir de deux
          champs à rassembler, et « Territoire » serait alors affiché deux fois
          (légende du bloc puis label du champ). Le label du champ porte donc
          lui-même le niveau de titre (`fr-h6`), pour une hiérarchie visuelle
          identique aux autres familles sans la redondance. */}
      <div className={FIELD_ROW_CLASS}>
        <MultiSelectFilter
          label="Territoire"
          labelClassName="fr-h6 mb-0 block"
          hint="Par défaut, tous les territoires sont sélectionnés"
          placeholder="Choisissez un département"
          options={options.areas}
          selectedIds={filters.areaIds ?? []}
          onChange={(ids) => update("areaIds", { areaIds: toFilterValue(ids) })}
          isLoading={isRecalculating("areaIds")}
        />
      </div>

      <fieldset className="m-0 flex flex-col gap-6 border-0 p-0">
        {/* Le texte d'aide vaut pour les deux champs de la famille : il est
            porté par la section, pas répété sur chaque champ. */}
        <legend className="fr-h6 mb-2">Auteur des signalements</legend>
        <p className="fr-hint-text mb-0">
          Par défaut, toutes les équipes sont sélectionnées
        </p>
        <div className={FIELD_ROW_CLASS}>
          <MultiSelectFilter
            label="Organisation autrice"
            placeholder="Choisissez une organisation autrice"
            options={options.authorOrganizations}
            selectedIds={filters.authorOrganizationIds ?? []}
            onChange={(ids) =>
              update("authorOrganizationIds", {
                authorOrganizationIds: toFilterValue(ids),
              })
            }
            isLoading={isRecalculating("authorOrganizationIds")}
          />
          <MultiSelectFilter
            label="Équipe autrice"
            placeholder="Choisissez une équipe autrice"
            options={options.authorTeams}
            selectedIds={filters.authorTeamIds ?? []}
            onChange={(ids) =>
              update("authorTeamIds", { authorTeamIds: toFilterValue(ids) })
            }
            isLoading={isRecalculating("authorTeamIds")}
          />
        </div>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-6 border-0 p-0">
        <legend className="fr-h6 mb-2">Destinataire des signalements</legend>
        <p className="fr-hint-text mb-0">
          Par défaut, toutes les équipes sont sélectionnées
        </p>
        <div className={FIELD_ROW_CLASS}>
          <MultiSelectFilter
            label="Organisation d'opérateurs"
            placeholder="Choisissez une organisation d'opérateurs"
            options={options.requestedOrganizations}
            selectedIds={filters.requestedOrganizationIds ?? []}
            onChange={(ids) =>
              update("requestedOrganizationIds", {
                requestedOrganizationIds: toFilterValue(ids),
              })
            }
            isLoading={isRecalculating("requestedOrganizationIds")}
          />
          <MultiSelectFilter
            label="Équipe d'opérateurs"
            placeholder="Choisissez une équipe d'opérateurs"
            options={options.requestedTeams}
            selectedIds={filters.requestedTeamIds ?? []}
            onChange={(ids) =>
              update("requestedTeamIds", {
                requestedTeamIds: toFilterValue(ids),
              })
            }
            isLoading={isRecalculating("requestedTeamIds")}
          />
        </div>
      </fieldset>

      {/* Le recalcul des options à facettes est signalé visuellement par un
          indicateur à droite de chaque champ ; il est annoncé une seule fois
          ici aux lecteurs d'écran (RGAA), sans doublon visuel. */}
      <div role="status" aria-live="polite" className="fr-sr-only">
        {isLoadingOptions && "Mise à jour des options de filtres…"}
      </div>
    </div>
  );
}
