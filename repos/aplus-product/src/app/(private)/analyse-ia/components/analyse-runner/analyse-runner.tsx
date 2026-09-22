"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@codegouvfr/react-dsfr/Button";
import Input from "@codegouvfr/react-dsfr/Input";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Card from "@codegouvfr/react-dsfr/Card";
import Tag from "@codegouvfr/react-dsfr/Tag";
import {
  TAG_AXES,
  TAG_AXIS_LABELS,
  type FreeTag,
  type TagAxis,
} from "@/lib/ai/tag-axes";
import { TagMatrix } from "../tag-matrix/tag-matrix";
import { TagTimeline } from "../tag-timeline/tag-timeline";
import { formatDate } from "@/app/component/reports-table/reports-table-utils/reports-table.utils";

interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

interface AnalysedItem {
  id: string;
  // ISO 8601 — date de dépôt du signalement (pas de l'analyse) : dimension
  // temporelle des futurs graphes d'évolution des tags.
  createdAt?: string;
  subject: string;
  summary: string;
  tags: FreeTag[];
  guardOk: boolean;
  usage?: UsageTotals;
}

type StreamEvent =
  | { type: "start"; total: number }
  | ({ type: "item" } & AnalysedItem)
  | { type: "step"; id: string; step: string }
  | { type: "item-error"; id: string; message: string; usage?: UsageTotals }
  | { type: "progress"; processed: number; total: number }
  | { type: "aborted"; message: string }
  | { type: "done"; processed: number };

const STORAGE_KEY = "analyse-ia-items";
const USAGE_STORAGE_KEY = "analyse-ia-usage";
const DAILY_CALLS_STORAGE_KEY = "analyse-ia-daily-calls";

// Quota requêtes/jour de la clé Albert (offre Expérimentation). À ajuster si
// la clé passe en « Production Limitée » (50 000/j).
const ALBERT_DAILY_REQUEST_LIMIT = 1000;

// Libellés FR des étapes du pipeline, pour le suivi en direct pendant un run.
const STEP_LABELS: Record<string, string> = {
  pseudonymize: "pseudonymisation",
  names: "extraction des noms",
  summary: "résumé",
  oneline: "résumé court",
  tags: "tags taxonomie",
  "summarize-tag": "résumé + tags",
  guard: "contrôle PII",
};

interface DailyCalls {
  date: string;
  calls: number;
}

// Date locale AAAA-MM-JJ : approximation de la fenêtre de quota Albert (dont
// l'heure exacte de remise à zéro n'est pas documentée).
function todayKey(): string {
  return new Intl.DateTimeFormat("fr-CA").format(new Date());
}

function addUsage(a: UsageTotals, b: UsageTotals | undefined): UsageTotals {
  if (!b) return a;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    calls: a.calls + b.calls,
  };
}

export function AnalyseRunner() {
  const [count, setCount] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [items, setItems] = useState<AnalysedItem[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [lastItemError, setLastItemError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  // Filtres actifs (cumulables en ET) : un signalement doit porter TOUS les
  // tags sélectionnés pour rester affiché.
  const [filters, setFilters] = useState<FreeTag[]>([]);
  const [usage, setUsage] = useState<UsageTotals>({
    inputTokens: 0,
    outputTokens: 0,
    calls: 0,
  });
  // Requêtes du jour vues par CE navigateur : pilotage à vue du quota RPD.
  // Non remis à zéro par « Vider » (le quota est une réalité externe).
  const [dailyCalls, setDailyCalls] = useState<DailyCalls>({
    date: "",
    calls: 0,
  });

  // useEffect justifié : API navigateur (localStorage). Charge les résultats
  // des runs précédents au montage → survit au rechargement de page.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AnalysedItem[];
        // Les runs antérieurs au tagage par axes stockaient des tags à plat
        // (string[]) : format incompatible, on repart de zéro plutôt que de
        // rendre des tags illisibles.
        const isCurrentFormat = parsed.every((item) =>
          item.tags.every((tag) => typeof tag === "object" && tag !== null),
        );
        if (isCurrentFormat) setItems(parsed);
      }
      const savedUsage = localStorage.getItem(USAGE_STORAGE_KEY);
      if (savedUsage) setUsage(JSON.parse(savedUsage) as UsageTotals);
      const savedDaily = localStorage.getItem(DAILY_CALLS_STORAGE_KEY);
      if (savedDaily) {
        const parsed = JSON.parse(savedDaily) as DailyCalls;
        // Jour révolu : le compteur repart de zéro.
        if (parsed.date === todayKey()) setDailyCalls(parsed);
      }
    } catch {
      // stockage indisponible ou corrompu : on repart de zéro
    }
    setLoaded(true);
  }, []);

  // useEffect justifié : persiste dans localStorage à chaque changement. Le
  // garde `loaded` évite d'écraser le stockage avant le chargement initial.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // quota dépassé : on ignore
    }
  }, [items, loaded]);

  // useEffect justifié : persiste la conso cumulée (séparée des items — les
  // tokens des signalements en erreur comptent aussi).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
    } catch {
      // quota dépassé : on ignore
    }
  }, [usage, loaded]);

  // useEffect justifié : persiste le compteur de requêtes du jour.
  useEffect(() => {
    if (!loaded || !dailyCalls.date) return;
    try {
      localStorage.setItem(DAILY_CALLS_STORAGE_KEY, JSON.stringify(dailyCalls));
    } catch {
      // quota dépassé : on ignore
    }
  }, [dailyCalls, loaded]);

  // useEffect justifié : API navigateur (beforeunload). Recharger ou fermer
  // l'onglet pendant un run tue le flux et donc le run — on prévient.
  useEffect(() => {
    if (!isRunning) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRunning]);

  // Agrège les tags axe par axe : la taxonomie qui émerge, une dimension à la
  // fois (quels organismes ? quels blocages reviennent ?), triée par fréquence.
  const aggregatedByAxis = useMemo(() => {
    const counts = new Map<TagAxis, Map<string, number>>(
      TAG_AXES.map((axis) => [axis, new Map<string, number>()]),
    );
    for (const item of items) {
      for (const tag of item.tags) {
        const axisCounts = counts.get(tag.axis);
        if (!axisCounts) continue;
        axisCounts.set(tag.label, (axisCounts.get(tag.label) ?? 0) + 1);
      }
    }
    return TAG_AXES.map((axis) => ({
      axis,
      tags: [...(counts.get(axis) ?? [])]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
    })).filter((group) => group.tags.length > 0);
  }, [items]);

  function isSameTag(a: FreeTag, b: FreeTag) {
    return a.axis === b.axis && a.label === b.label;
  }

  function isFilterActive(tag: FreeTag) {
    return filters.some((filter) => isSameTag(filter, tag));
  }

  function toggleFilter(tag: FreeTag) {
    setFilters((prev) =>
      prev.some((filter) => isSameTag(filter, tag))
        ? prev.filter((filter) => !isSameTag(filter, tag))
        : [...prev, tag],
    );
  }

  const filteredItems =
    filters.length === 0
      ? items
      : items.filter((item) =>
          filters.every((filter) =>
            item.tags.some((tag) => isSameTag(tag, filter)),
          ),
        );

  // Clic sur une cellule de la matrice : focalise les filtres sur cette paire ;
  // re-clic sur la paire déjà active : efface tout.
  function handleMatrixSelect(organisme: FreeTag, blocage: FreeTag) {
    setFilters(
      isFilterActive(organisme) && isFilterActive(blocage)
        ? []
        : [organisme, blocage],
    );
  }

  function trackDailyCalls(delta: number | undefined) {
    if (!delta) return;
    setDailyCalls((prev) => {
      const today = todayKey();
      return prev.date === today
        ? { date: today, calls: prev.calls + delta }
        : { date: today, calls: delta };
    });
  }

  function handleEvent(event: StreamEvent) {
    if (event.type === "start") {
      setTotal(event.total);
    } else if (event.type === "step") {
      setCurrentStep(STEP_LABELS[event.step] ?? event.step);
    } else if (event.type === "item") {
      setUsage((prev) => addUsage(prev, event.usage));
      trackDailyCalls(event.usage?.calls);
      // Empile en dédupliquant par id (au cas où).
      setItems((prev) =>
        prev.some((i) => i.id === event.id)
          ? prev
          : [
              ...prev,
              {
                id: event.id,
                createdAt: event.createdAt,
                subject: event.subject,
                summary: event.summary,
                tags: event.tags,
                guardOk: event.guardOk,
                usage: event.usage,
              },
            ],
      );
    } else if (event.type === "item-error") {
      setUsage((prev) => addUsage(prev, event.usage));
      trackDailyCalls(event.usage?.calls);
      setErrorCount((prev) => prev + 1);
      setLastItemError(event.message);
    } else if (event.type === "progress") {
      setProcessed(event.processed);
      setCurrentStep(null);
    } else if (event.type === "aborted") {
      setError(event.message);
    }
  }

  async function handleRun() {
    setIsRunning(true);
    setProcessed(0);
    setTotal(0);
    setErrorCount(0);
    setLastItemError(null);
    setError(null);

    // Suivi local du run : les states React sont périmés dans cette closure,
    // et seule la réception du `done` prouve que le flux est allé au bout.
    let sawDone = false;
    let lastProcessed = 0;
    let runTotal = 0;

    try {
      const response = await fetch("/analyse-ia/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // On exclut les signalements déjà analysés → chaque run apporte des
        // signalements NEUFS, sans re-payer les appels Albert. Les libellés
        // déjà émergés (triés par fréquence) sont renvoyés pour que le modèle
        // les réutilise au lieu d'inventer des variantes.
        body: JSON.stringify({
          count,
          excludeIds: items.map((i) => i.id),
          knownLabels: Object.fromEntries(
            aggregatedByAxis.map((group) => [
              group.axis,
              group.tags.map((tag) => tag.label),
            ]),
          ),
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`Échec du lancement (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          // `aborted` est aussi une fin de flux voulue par le serveur : ne pas
          // la re-signaler comme coupure réseau.
          if (event.type === "done" || event.type === "aborted") sawDone = true;
          if (event.type === "start") runTotal = event.total;
          if (event.type === "progress") lastProcessed = event.processed;
          handleEvent(event);
        }
      }
      // Flux terminé sans `done` : coupure silencieuse (rechargement de page,
      // veille machine, réseau, crash serveur). Sans ce message, le run
      // s'arrête sans aucune trace visible.
      if (!sawDone) {
        setError(
          `Analyse interrompue à ${lastProcessed} / ${runTotal} : le flux a été coupé. ` +
            "Relance l'analyse : elle reprendra où elle s'est arrêtée, sans re-payer les signalements déjà analysés.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setIsRunning(false);
      setCurrentStep(null);
    }
  }

  function handleClear() {
    setItems([]);
    setProcessed(0);
    setTotal(0);
    setErrorCount(0);
    setUsage({ inputTokens: 0, outputTokens: 0, calls: 0 });
    setFilters([]);
  }

  return (
    <div className="my-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Input
          label="Signalements à analyser (en plus des déjà faits)"
          className="fr-mb-0 w-full max-w-xs"
          nativeInputProps={{
            type: "number",
            min: 1,
            max: 1000,
            value: count,
            onChange: (e) => setCount(Number(e.target.value)),
            disabled: isRunning,
          }}
        />
        <Button onClick={handleRun} disabled={isRunning}>
          {isRunning ? "Analyse en cours…" : "Lancer l'analyse"}
        </Button>
        {items.length > 0 && (
          <Button
            priority="secondary"
            onClick={handleClear}
            disabled={isRunning}
          >
            Vider
          </Button>
        )}
      </div>

      {error && <p style={{ color: "#c9191e" }}>{error}</p>}

      <p role="status" className="text-sm">
        Déjà analysés : <strong>{items.length}</strong>
        {isRunning ? ` · run en cours : ${processed} / ${total}` : ""}
        {isRunning && currentStep ? ` · ${currentStep}…` : ""}
        {errorCount > 0 ? ` · ${errorCount} en erreur` : ""}
      </p>

      {lastItemError && (
        <p className="m-0 text-sm" style={{ color: "#c9191e" }}>
          Dernière erreur : {lastItemError}
        </p>
      )}

      {(usage.calls > 0 || dailyCalls.calls > 0) && (
        <p className="m-0 text-sm text-[#666]">
          Conso Albert : {usage.calls.toLocaleString("fr-FR")} appels ·{" "}
          {usage.inputTokens.toLocaleString("fr-FR")} tokens entrée ·{" "}
          {usage.outputTokens.toLocaleString("fr-FR")} tokens sortie · requêtes
          aujourd&apos;hui : {dailyCalls.calls.toLocaleString("fr-FR")} /{" "}
          {ALBERT_DAILY_REQUEST_LIMIT.toLocaleString("fr-FR")} (offre
          Expérimentation, vues par ce navigateur)
        </p>
      )}

      {aggregatedByAxis.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="fr-h5 fr-mb-0">Tags émergents</h2>
          {aggregatedByAxis.map((group) => (
            <div key={group.axis}>
              <h3 className="fr-text--sm fr-mb-1w font-bold">
                {TAG_AXIS_LABELS[group.axis]} ({group.tags.length})
              </h3>
              <ul className="fr-tags-group">
                {group.tags.map((tag) => (
                  <li key={tag.label}>
                    <Tag
                      pressed={isFilterActive({
                        axis: group.axis,
                        label: tag.label,
                      })}
                      nativeButtonProps={{
                        onClick: () =>
                          toggleFilter({ axis: group.axis, label: tag.label }),
                      }}
                    >
                      {tag.label} · {tag.count}
                    </Tag>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {items.length > 0 && (
        <TagMatrix
          items={items}
          filters={filters}
          onSelectPair={handleMatrixSelect}
        />
      )}

      {/* Items FILTRÉS : sélectionner des tags trace l'historique de ce
          sous-ensemble (ex : carsat × absence de réponse dans le temps). */}
      <TagTimeline items={filteredItems} isFiltered={filters.length > 0} />

      {items.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="fr-h5 fr-mb-0">
              Résultats ({filteredItems.length}
              {filters.length > 0 ? ` / ${items.length}` : ""})
            </h2>
            {filters.length > 0 && (
              <Button
                priority="tertiary no outline"
                size="small"
                onClick={() => setFilters([])}
              >
                Réinitialiser le filtre
              </Button>
            )}
          </div>
          {filteredItems.length === 0 && (
            <p className="text-sm">
              Aucun signalement ne porte tous les tags sélectionnés.
            </p>
          )}
          <div className="fr-grid-row fr-grid-row--gutters">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="fr-col-12 fr-col-md-6 fr-col-lg-3 fr-col-xl-3"
              >
                <Card
                  title={item.subject}
                  titleAs="h3"
                  desc={item.summary}
                  size="small"
                  border
                  background
                  detail={
                    item.createdAt
                      ? `Déposé le ${formatDate(item.createdAt)}`
                      : undefined
                  }
                  start={
                    !item.guardOk ? (
                      <ul className="fr-badges-group">
                        <li>
                          <Badge severity="warning" small noIcon>
                            PII résiduelle
                          </Badge>
                        </li>
                      </ul>
                    ) : undefined
                  }
                  end={
                    item.tags.length > 0 ? (
                      <ul className="fr-tags-group">
                        {item.tags.map((tag) => (
                          <li key={tag.axis}>
                            <Tag
                              small
                              title={TAG_AXIS_LABELS[tag.axis]}
                              pressed={isFilterActive(tag)}
                              nativeButtonProps={{
                                onClick: () => toggleFilter(tag),
                              }}
                            >
                              {tag.label}
                            </Tag>
                          </li>
                        ))}
                      </ul>
                    ) : undefined
                  }
                  endDetail={
                    item.usage
                      ? `${(item.usage.inputTokens + item.usage.outputTokens).toLocaleString("fr-FR")} tokens · ${item.usage.calls} appels`
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
