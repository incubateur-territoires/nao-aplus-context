"use client";

import { createElement, useEffect, useRef, useState } from "react";
import "@gouvfr/dsfr-chart/dist/DSFRChart/DSFRChart.css";
import { formatPercentage, sumValues } from "@/utils/stats-percentage";

export type StatsChartType = "bar" | "pie";

interface StatsChartProps {
  type: StatsChartType;
  labels: string[];
  values: number[];
  /** Nom de la série (légende) pour les graphiques en barres. */
  seriesName?: string;
  /** Unité affichée dans l'infobulle (ex. « signalements »). */
  unit?: string;
  /**
   * Annote chaque valeur de sa part du total dans l'infobulle de survol
   * (« 37 610 signalements (70,8 %) »). Réservé aux séries dont le total fait
   * sens — les portions d'un donut.
   */
  withPercentage?: boolean;
}

const numberFormatter = new Intl.NumberFormat("fr-FR");

// Rapport largeur/hauteur du canvas, calé sur la maquette : 800×374 pour les
// barres, 800×480 pour les donuts (dont le diamètre suit la hauteur).
const ASPECT_RATIO: Record<StatsChartType, string> = {
  bar: "2.14",
  pie: "1.67",
};

// Écart ajouté au ratio pour que le web-component voie une nouvelle valeur et
// reconstruise le graphique : assez petit pour ne rien changer à l'affichage.
const RATIO_NUDGE = 0.0001;

// Délai d'inactivité avant de reconstruire un graphique redimensionné.
const RESIZE_DEBOUNCE_MS = 150;

/**
 * Le web-component ne sait afficher dans son infobulle que la valeur brute
 * suivie de `unit-tooltip` — un texte commun à toutes les portions, où l'on ne
 * peut donc pas glisser une part qui varie de l'une à l'autre. Aucun attribut
 * n'expose ce formatage, mais le composant Vue garde son instance Chart.js à
 * portée : on y remplace le formatage de la ligne de valeur.
 *
 * On s'appuie ici sur des détails internes (`_instance` de Vue, options de
 * Chart.js) : tout est donc optionnel et lu défensivement. Si une mise à jour
 * de `@gouvfr/dsfr-chart` déplace ces objets, l'infobulle perd le pourcentage
 * et retombe sur son affichage d'origine, sans rien casser.
 */
interface ChartJsTooltipContext {
  parsed: number;
}

interface ChartJsInstance {
  options?: {
    plugins?: {
      tooltip?: {
        callbacks?: {
          label?: (context: ChartJsTooltipContext) => string[];
        };
      };
    };
  };
}

interface DsfrChartElement extends Element {
  _instance?: { proxy?: { chart?: ChartJsInstance } };
}

/**
 * Fait afficher « 37 610 signalements (70,8 %) » à l'infobulle, là où le
 * composant n'écrirait que « 37 610 ». Renvoie `false` si l'instance Chart.js
 * n'a pas pu être atteinte, pour que l'appelant réessaie à la reconstruction.
 */
function applyPercentageTooltip(
  chartElement: Element,
  values: number[],
  unit: string | undefined,
): boolean {
  const callbacks = (chartElement as DsfrChartElement)._instance?.proxy?.chart
    ?.options?.plugins?.tooltip?.callbacks;
  if (!callbacks) return false;

  const total = sumValues(values);
  const suffix = unit ? ` ${unit}` : "";
  // Chart.js attend une liste : une entrée par ligne de l'infobulle.
  callbacks.label = (context) => [
    `${numberFormatter.format(context.parsed)}${suffix} (${formatPercentage(context.parsed, total)})`,
  ];
  return true;
}

// Les web-components `@gouvfr/dsfr-chart` (Vue + Chart.js) s'enregistrent via un
// import à effet de bord qui touche `window`/`customElements` : on l'importe donc
// uniquement côté client, après montage, pour éviter toute évaluation côté serveur.
let libPromise: Promise<unknown> | null = null;
function loadChartLib(): Promise<unknown> {
  if (!libPromise) {
    libPromise = import("@gouvfr/dsfr-chart");
  }
  return libPromise;
}

export function StatsChart({
  type,
  labels,
  values,
  seriesName,
  unit,
  withPercentage,
}: StatsChartProps) {
  const [isReady, setIsReady] = useState(false);
  // Voir `useEffect` de redimensionnement : bascule entre 0 et RATIO_NUDGE pour
  // forcer la reconstruction du graphique à la largeur courante.
  const [nudge, setNudge] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isActive = true;
    loadChartLib().then(() => {
      if (isActive) setIsReady(true);
    });
    return () => {
      isActive = false;
    };
  }, []);

  // dsfr-chart mesure son canvas à la création du graphique, avant que celui-ci
  // soit inséré dans le document : Chart.js retombe alors sur la taille par
  // défaut d'un canvas (300×150) et ne la recalcule jamais, quelle que soit la
  // largeur du conteneur. Le composant Vue recrée en revanche le graphique dès
  // qu'une de ses props change. On pose donc `aspect-ratio` une fois le canvas
  // monté (le composant réécrit sinon sa valeur par défaut par-dessus) : le
  // graphique est reconstruit alors que le canvas est attaché, et occupe enfin
  // toute la largeur disponible.
  useEffect(() => {
    if (!isReady) return;
    const chart = containerRef.current?.firstElementChild;
    if (!chart) return;

    const ratio = String(Number(ASPECT_RATIO[type]) + nudge);
    function applyRatio(element: Element) {
      if (element.getAttribute("aspect-ratio") !== ratio) {
        element.setAttribute("aspect-ratio", ratio);
      }
    }

    if (chart.querySelector("canvas")) {
      applyRatio(chart);
      return;
    }
    const observer = new MutationObserver(() => {
      if (chart.querySelector("canvas")) {
        observer.disconnect();
        applyRatio(chart);
      }
    });
    observer.observe(chart, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isReady, type, nudge]);

  // Le formatage de l'infobulle vit sur l'instance Chart.js, que le composant
  // Vue jette et reconstruit à chaque changement de prop (nouveaux filtres,
  // reconstruction au redimensionnement) : le poser une fois ne suffit pas, et
  // il n'existe pas encore à la première insertion du canvas. Plutôt que de
  // courir après ces reconstructions, on le repose à chaque survol — en phase
  // de capture, donc avant que Chart.js ne traite l'événement et ne calcule
  // l'infobulle. Un graphique survolable est forcément construit.
  useEffect(() => {
    if (!isReady || !withPercentage) return;
    const container = containerRef.current;
    const chart = container?.firstElementChild;
    if (!container || !chart) return;

    function handlePointerMove() {
      if (chart) applyPercentageTooltip(chart, values, unit);
    }

    container.addEventListener("mousemove", handlePointerMove, true);
    return () =>
      container.removeEventListener("mousemove", handlePointerMove, true);
  }, [isReady, withPercentage, values, unit]);

  // Corollaire du bug ci-dessus : le canvas garde pour toujours la largeur qu'il
  // avait à la construction du graphique. Il rétrécit (il est borné par son
  // conteneur) mais ne se ré-étire jamais, donc une carte qui s'élargit — deux
  // colonnes qui repassent à une — laisse un canvas trop étroit jusqu'au
  // rechargement de la page. On reconstruit donc le graphique à chaque
  // changement de largeur, en variant `aspect-ratio` d'un delta invisible : le
  // composant Vue ne se reconstruit que sur un vrai changement de prop, et
  // reposer la même valeur n'en est pas un.
  useEffect(() => {
    if (!isReady) return;
    const container = containerRef.current;
    if (!container) return;

    let width = container.getBoundingClientRect().width;
    let timeout: ReturnType<typeof setTimeout>;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      // La reconstruction ne change que la hauteur du canvas : observer la
      // seule largeur évite de se ré-armer soi-même en boucle.
      if (nextWidth === 0 || nextWidth === width) return;
      width = nextWidth;
      // Un glissement de fenêtre émet des dizaines d'événements : on ne
      // reconstruit qu'une fois le redimensionnement reposé.
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setNudge((current) => (current === 0 ? RATIO_NUDGE : 0));
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [isReady]);

  // Même bloc gris pulsant que StatsSkeleton : la page garde un seul langage de
  // chargement, que l'attente vienne des données (squelette de carte) ou du
  // chargement différé de la librairie de graphiques.
  if (!isReady) {
    return (
      <>
        <p role="status" className="fr-sr-only">
          Chargement du graphique…
        </p>
        <div
          aria-hidden="true"
          className="h-[300px] rounded bg-[#eeeeee] motion-safe:animate-pulse"
        />
      </>
    );
  }

  const tag = type === "bar" ? "bar-chart" : "pie-chart";
  const x = JSON.stringify([labels]);
  const y = JSON.stringify([values]);
  // Bar: une seule série nommée. Pie: la légende reprend les libellés.
  const name =
    type === "bar"
      ? JSON.stringify([seriesName ?? ""])
      : JSON.stringify(labels);

  // Le donut a un trou central (`cutout: 50 %`) et sa légende intégrée est
  // masquée (CSS `.stats-chart`) : il occupe donc tout le canvas et son centre
  // coïncide avec celui du conteneur. On y superpose le total de la série.
  const showTotal = type === "pie";
  const total = sumValues(values);

  // `createElement` avec un tag string contourne le typage JSX.IntrinsicElements
  // et passe les attributs (kebab-case) tels quels au web-component.
  // Le wrapper `.stats-chart` masque la légende intégrée du web-component
  // (CSS global) : elle est remplacée par la légende maison (StatLegend).
  return (
    <div
      className="stats-chart relative"
      ref={containerRef}
      // `container-type: inline-size` pour un donut : le total du trou central
      // est dimensionné en `cqw` (part de la largeur de la carte) et suit donc
      // le diamètre du donut au lieu de déborder quand la carte rétrécit.
      style={showTotal ? { containerType: "inline-size" } : undefined}
    >
      {createElement(tag, {
        x,
        y,
        name,
        // Avec le pourcentage, l'unité est déjà dans la ligne reformatée : la
        // laisser ici la ferait suivre la parenthèse (« 37 610 (70,8 %)
        // signalements »).
        ...(unit && !withPercentage ? { "unit-tooltip": unit } : {}),
      })}
      {showTotal && (
        // Overlay centré sur le trou du donut. `pointer-events-none` pour ne pas
        // intercepter le survol dont Chart.js a besoin pour ses infobulles.
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          {/* Diamètre du trou ≈ 30 % de la largeur (donut bridé par la hauteur,
              ratio 1.67, cutout 50 %) : on garde le nombre sous ce budget tout
              en le plafonnant sur les grandes cartes. */}
          {/* `leading-[0.8]` recadre la boîte de ligne au ras des chiffres (sans
              jambage) : l'espace sous le nombre ne reste pas fixe quand le texte
              rétrécit. La marge suit le donut (`cqw`) plutôt qu'un `mt-1` fixe,
              trop grand une fois le nombre réduit sur mobile. */}
          <span
            className="font-bold leading-[0.8] text-[#3a3a4d]"
            style={{ fontSize: "clamp(0.9rem, 6.5cqw, 2rem)" }}
          >
            {numberFormatter.format(total)}
          </span>
          <span
            className="font-medium uppercase tracking-wide text-[#929292]"
            style={{
              fontSize: "clamp(0.55rem, 2.2cqw, 0.875rem)",
              marginTop: "clamp(2px, 0.6cqw, 6px)",
            }}
          >
            Total
          </span>
        </div>
      )}
    </div>
  );
}
