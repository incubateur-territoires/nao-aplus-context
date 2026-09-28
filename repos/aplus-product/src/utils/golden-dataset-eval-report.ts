import {
  GOLDEN_TAG_AXES,
  type GoldenTagAxis,
} from "@/utils/golden-dataset-golden-tags";
import type { EvalRecipe } from "@/utils/golden-dataset-eval-run";
import type {
  AxisScores,
  Proportion,
  RunModeKind,
  SubsetScores,
  TagScore,
} from "@/utils/golden-dataset-scoring";
import { GOLDEN_SPLITS, type GoldenSplit } from "@/utils/golden-dataset-split";
import { diffLines, LINE_DIFF_KINDS } from "@/utils/line-diff";

/**
 * Mise en forme de la correction : un tableau comparatif des séries, puis le
 * détail par série. Deux rendus du même contenu, console et page HTML autonome.
 */

export interface ReportSeries {
  readonly fileName: string;
  readonly recipe: EvalRecipe;
  /** Faux quand le code n'enverrait plus cette consigne aujourd'hui. */
  readonly promptIsCurrent: boolean;
  readonly scores: SubsetScores;
}

export interface EvalReport {
  readonly split: GoldenSplit;
  readonly generatedAt: string;
  readonly series: readonly ReportSeries[];
  readonly notes: readonly string[];
}

const AXIS_LABELS: { readonly [A in GoldenTagAxis]: string } = {
  blockageTag: "Blocage",
  procedureTag: "Démarche",
};

const MODE_LABELS: { readonly [M in RunModeKind]: string } = {
  free: "texte libre",
  closed: "liste fermée",
  fine: "labels fins",
};

const SPLIT_TITLES: { readonly [S in GoldenSplit]: string } = {
  tuning: "Mise au point (30 items)",
  test: "EXAMEN (70 items) : à ne regarder qu'une fois par consigne retenue",
};

const NOT_APPLICABLE = "n/a";

function percent(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

export function formatProportion(proportion: Proportion | null): string {
  if (proportion === null) return NOT_APPLICABLE;
  return `${percent(proportion.rate)} [${percent(proportion.low)}-${percent(proportion.high)}] ${proportion.correct}/${proportion.n}`;
}

function formatRatio(part: number, whole: number): string {
  return whole === 0
    ? NOT_APPLICABLE
    : `${part}/${whole} (${percent(part / whole)})`;
}

export function seriesLabel(series: ReportSeries): string {
  const { recipe } = series;
  const stale = series.promptIsCurrent ? "" : " (consigne ancienne)";
  const note = recipe.note ? `${recipe.note} · ` : "";
  return `${note}${MODE_LABELS[recipe.mode]} · ${recipe.model} · t=${recipe.temperature} · ${recipe.promptHash.slice(0, 8)}${stale}`;
}

export interface ComparisonRow {
  /** `null` pour les lignes communes aux deux axes. */
  readonly axis: GoldenTagAxis | null;
  readonly metric: string;
  readonly cells: readonly string[];
}

const AXIS_METRICS: readonly {
  readonly metric: string;
  readonly cell: (axis: AxisScores) => string;
}[] = [
  {
    metric: "Libellés, exacte",
    cell: (axis) => formatProportion(axis.fine?.strict ?? null),
  },
  {
    metric: "Libellés, indulgente",
    cell: (axis) => formatProportion(axis.fine?.lenient ?? null),
  },
  {
    metric: "Tags fermés, exacte",
    cell: (axis) => formatProportion(axis.closed.strict),
  },
  {
    metric: "Abstention",
    cell: ({ abstention }) =>
      formatRatio(abstention.abstained, abstention.predicted),
  },
  {
    metric: "Abstention sur gold « inconnu »",
    cell: ({ abstention }) =>
      formatRatio(
        abstention.abstainedOnGoldUndetermined,
        abstention.goldUndetermined,
      ),
  },
];

export function comparisonRows(report: EvalReport): ComparisonRow[] {
  const coverage: ComparisonRow = {
    axis: null,
    metric: "Couverture",
    cells: report.series.map(({ scores }) =>
      formatRatio(scores.predicted, scores.items),
    ),
  };

  return [
    coverage,
    ...GOLDEN_TAG_AXES.flatMap((axis) =>
      AXIS_METRICS.map(({ metric, cell }) => ({
        axis,
        metric,
        cells: report.series.map(({ scores }) => cell(scores.axes[axis])),
      })),
    ),
  ];
}

function rowTitle(row: ComparisonRow): string {
  return row.axis === null
    ? row.metric
    : `${AXIS_LABELS[row.axis]} · ${row.metric}`;
}

function formatRate(rate: number | null): string {
  return rate === null ? NOT_APPLICABLE : rate.toFixed(2);
}

function tagCells(score: TagScore): string[] {
  if (score.kind === "belowMinimum") {
    return [score.tag, String(score.support), "trop peu d'items", "", ""];
  }
  return [
    score.tag,
    String(score.support),
    formatRate(score.precision),
    formatRate(score.recall),
    formatRate(score.f1),
  ];
}

const TAG_HEADER = ["Tag", "Items", "Précision", "Rappel", "F1"];
const CONFUSION_HEADER = ["Attendu", "Prédit", "Fois"];
const CONSOLE_CONFUSIONS = 5;

function textTable(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column].length)),
  );
  function line(cells: readonly string[]): string {
    return cells
      .map((cell, column) => cell.padEnd(widths[column]))
      .join("  ")
      .trimEnd();
  }

  return [
    line(header),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map(line),
  ].join("\n");
}

export function renderReportText(report: EvalReport): string {
  const blocks: string[] = [`=== ${SPLIT_TITLES[report.split]} ===`];

  if (report.series.length === 0) {
    blocks.push("Aucune série dans le dossier des séries.");
  } else {
    blocks.push(
      report.series
        .map(
          (series, index) =>
            `S${index + 1} : ${seriesLabel(series)}\n    ${series.fileName}`,
        )
        .join("\n"),
    );
    blocks.push(
      textTable(
        ["", ...report.series.map((_, index) => `S${index + 1}`)],
        comparisonRows(report).map((row) => [rowTitle(row), ...row.cells]),
      ),
    );
    blocks.push("Intervalles de confiance à 95 % (Wilson) entre crochets.");
  }

  report.series.forEach((series, index) => {
    for (const axis of GOLDEN_TAG_AXES) {
      const closed = series.scores.axes[axis].closed;
      const confusions = closed.confusions.slice(0, CONSOLE_CONFUSIONS);
      blocks.push(
        [
          `--- S${index + 1} · ${AXIS_LABELS[axis]} ---`,
          textTable(TAG_HEADER, closed.perTag.map(tagCells)),
          confusions.length === 0
            ? "Aucune confusion."
            : `Confusions les plus fréquentes :\n${textTable(
                CONFUSION_HEADER,
                confusions.map((c) => [c.gold, c.predicted, String(c.count)]),
              )}`,
        ].join("\n\n"),
      );
    }
  });

  if (report.notes.length > 0) {
    blocks.push(report.notes.map((note) => `! ${note}`).join("\n"));
  }

  return `${blocks.join("\n\n")}\n`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlTable(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const head = header
    .map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`)
    .join("");
  const body = rows
    .map(
      ([first, ...rest]) =>
        `<tr><th scope="row">${escapeHtml(first)}</th>${rest
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("\n");
  return `<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

function seriesDetails(series: ReportSeries, index: number): string {
  const { recipe } = series;
  const axes = GOLDEN_TAG_AXES.map((axis) => {
    const closed = series.scores.axes[axis].closed;
    const confusions =
      closed.confusions.length === 0
        ? "<p>Aucune confusion.</p>"
        : htmlTable(
            CONFUSION_HEADER,
            closed.confusions.map((c) => [
              c.gold,
              c.predicted,
              String(c.count),
            ]),
          );
    return `<h4>${escapeHtml(AXIS_LABELS[axis])}</h4>\n${htmlTable(
      TAG_HEADER,
      closed.perTag.map(tagCells),
    )}\n<h5>Confusions</h5>\n${confusions}`;
  }).join("\n");

  return `<details>
<summary>S${index + 1} · ${escapeHtml(seriesLabel(series))}</summary>
<dl>
<dt>Fichier</dt><dd><code>${escapeHtml(series.fileName)}</code></dd>
<dt>Modèle</dt><dd>${escapeHtml(recipe.model)}</dd>
<dt>Mode</dt><dd>${escapeHtml(MODE_LABELS[recipe.mode])}${
    recipe.taxonomyVersion === null ? "" : ` (liste v${recipe.taxonomyVersion})`
  }</dd>
<dt>Température</dt><dd>${recipe.temperature}</dd>
<dt>Consigne</dt><dd><code>${escapeHtml(recipe.promptHash.slice(0, 12))}</code>${
    series.promptIsCurrent ? " (celle du code)" : " (n'est plus celle du code)"
  }</dd>
<dt>Créée le</dt><dd>${escapeHtml(recipe.createdAt)}</dd>
</dl>
${axes}
<details><summary>Consigne système</summary><pre>${escapeHtml(recipe.systemPrompt)}</pre></details>
<details><summary>Gabarit utilisateur</summary><pre>${escapeHtml(recipe.userTemplate)}</pre></details>
</details>`;
}

const STYLE = `body{font:16px/1.5 system-ui,sans-serif;color:#161616;max-width:60rem;margin:2rem auto;padding:0 1rem}
h1{font-size:1.6rem;margin-bottom:.2rem}h2{font-size:1.25rem;margin-top:2.5rem;border-bottom:2px solid #000091;padding-bottom:.2rem}
h3{font-size:1.05rem;margin-top:1.5rem}h4{margin:1.2rem 0 .4rem}h5{margin:.8rem 0 .3rem}
.lead{color:#3a3a3a;max-width:44rem}
table{border-collapse:collapse;margin:.5rem 0;font-variant-numeric:tabular-nums}
th,td{border:1px solid #ddd;padding:.3rem .6rem;text-align:left;vertical-align:top}
thead th{background:#f0f0f0}tbody th{font-weight:500}
table.simple{width:100%}table.simple td,table.simple th{padding:.6rem .8rem;vertical-align:middle}
.score{font-size:1.4rem;font-weight:700}.count{color:#666;font-size:.85rem;margin-left:.4rem}
.bar{height:6px;background:#eee;border-radius:3px;margin-top:.3rem}.bar span{display:block;height:6px;border-radius:3px;background:#000091}
.up{color:#18753c;font-weight:600;font-size:.85rem}.down{color:#ce0500;font-weight:600;font-size:.85rem}
.change{border-left:4px solid #000091;padding:.2rem 0 .2rem 1rem;margin:1rem 0}
pre.diff{white-space:pre-wrap;font-size:13px;background:#fafafa;padding:.6rem;border:1px solid #eee}
pre.diff .add{background:#e6f4ea;color:#18753c;display:block}pre.diff .del{background:#fdecea;color:#ce0500;display:block;text-decoration:line-through}
pre.diff .ctx{color:#666;display:block}pre.diff .gap{color:#aaa;display:block}
.exam{background:#fee;border:1px solid #c00;padding:.6rem 1rem}
.notes{background:#fff8e0;border:1px solid #d9a400;padding:.6rem 1rem}
details{border:1px solid #ddd;padding:.4rem .8rem;margin:.6rem 0}summary{cursor:pointer;font-weight:600}
dl{display:grid;grid-template-columns:max-content 1fr;gap:.2rem 1rem}dd{margin:0}
pre{white-space:pre-wrap;background:#f6f6f6;padding:.6rem;font-size:13px}
.muted{color:#666}`;

const MENU_TITLES: { readonly [M in RunModeKind]: string } = {
  closed: "Menu des catégories",
  fine: "Menu des libellés fins",
  free: "Texte libre",
};

const MENU_ORDER: readonly RunModeKind[] = ["closed", "fine", "free"];

/** Nom d'une version pour un lecteur : sa note, à défaut le début de son hash. */
export function versionName(series: ReportSeries): string {
  return (
    series.recipe.note ?? `consigne ${series.recipe.promptHash.slice(0, 8)}`
  );
}

function scoreCell(
  proportion: Proportion | null,
  previous: Proportion | null | undefined,
): string {
  if (proportion === null) return `<td class="muted">${NOT_APPLICABLE}</td>`;

  const points = Math.round(proportion.rate * 100);
  let delta = "";
  if (previous) {
    const change = points - Math.round(previous.rate * 100);
    if (change !== 0) {
      delta = ` <span class="${change > 0 ? "up" : "down"}">${change > 0 ? "+" : ""}${change} pts</span>`;
    }
  }

  return `<td><span class="score">${points} %</span><span class="count">${proportion.correct}/${proportion.n}</span>${delta}<div class="bar"><span style="width:${points}%"></span></div></td>`;
}

function abstentionCell(series: ReportSeries): string {
  const { abstention } = series.scores.axes.blockageTag;
  if (abstention.goldUndetermined === 0) {
    return `<td class="muted">${NOT_APPLICABLE}</td>`;
  }
  const wrong = abstention.abstained - abstention.abstainedOnGoldUndetermined;
  return `<td><span class="score">${abstention.abstainedOnGoldUndetermined}/${abstention.goldUndetermined}</span>${
    wrong > 0 ? `<span class="count">+ ${wrong} à tort</span>` : ""
  }</td>`;
}

const DIFF_CONTEXT = 1;

function renderDiff(before: string, after: string): string {
  const lines = diffLines(before, after);
  const keep = lines.map((line, index) =>
    lines
      .slice(Math.max(0, index - DIFF_CONTEXT), index + DIFF_CONTEXT + 1)
      .some((near) => near.kind !== LINE_DIFF_KINDS.SAME),
  );
  if (!keep.some(Boolean)) return `<p class="muted">Aucune différence.</p>`;

  const CLASSES = { same: "ctx", added: "add", removed: "del" } as const;
  const PREFIX = { same: "  ", added: "+ ", removed: "- " } as const;
  const out: string[] = [];
  lines.forEach((line, index) => {
    if (keep[index]) {
      out.push(
        `<span class="${CLASSES[line.kind]}">${PREFIX[line.kind]}${escapeHtml(line.text)}</span>`,
      );
    } else if (keep[index - 1] !== false || index === 0) {
      out.push(`<span class="gap">…</span>`);
    }
  });
  return `<pre class="diff">${out.join("")}</pre>`;
}

function menuSection(
  mode: RunModeKind,
  versions: readonly ReportSeries[],
): string {
  const rows = versions
    .map((series, index) => {
      const previous = versions[index - 1];
      const axes = series.scores.axes;
      return `<tr><th scope="row">${escapeHtml(versionName(series))}</th>${scoreCell(
        axes.blockageTag.closed.strict,
        previous?.scores.axes.blockageTag.closed.strict,
      )}${scoreCell(
        axes.procedureTag.closed.strict,
        previous?.scores.axes.procedureTag.closed.strict,
      )}${abstentionCell(series)}</tr>`;
    })
    .join("\n");

  const changes = versions
    .map((series, index) => {
      const previous = versions[index - 1];
      if (previous === undefined) {
        return `<details><summary>Consigne de départ : ${escapeHtml(versionName(series))}</summary><pre>${escapeHtml(series.recipe.systemPrompt)}</pre></details>`;
      }
      const template =
        previous.recipe.userTemplate === series.recipe.userTemplate
          ? ""
          : `<p>Présentation du signalement :</p>${renderDiff(previous.recipe.userTemplate, series.recipe.userTemplate)}`;
      return `<div class="change"><h4>${escapeHtml(versionName(previous))} → ${escapeHtml(versionName(series))}</h4>${renderDiff(
        previous.recipe.systemPrompt,
        series.recipe.systemPrompt,
      )}${template}</div>`;
    })
    .join("\n");

  return `<h2>${escapeHtml(MENU_TITLES[mode])}</h2>
<table class="simple">
<thead><tr><th scope="col">Version de la consigne</th><th scope="col">Blocage juste</th><th scope="col">Démarche juste</th><th scope="col">« Inconnu » bien placé (blocage)</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<h3>Ce qui a changé dans la consigne</h3>
${changes}`;
}

export function renderReportHtml(fullReport: EvalReport): string {
  // Une série sans aucune prédiction sur ce sous-ensemble n'a rien à montrer.
  const report = {
    ...fullReport,
    series: fullReport.series.filter(({ scores }) => scores.predicted > 0),
  };
  const exam = report.split === GOLDEN_SPLITS.TEST;
  const title = exam
    ? "Albert sur les 70 signalements de l'examen final"
    : "Albert sur les 30 signalements d'entraînement";
  const banner = exam
    ? `<p class="exam">Examen : ces scores ne servent pas à ajuster la consigne.</p>`
    : "";
  const notes =
    report.notes.length === 0
      ? ""
      : `<div class="notes"><ul>${report.notes
          .map((note) => `<li>${escapeHtml(note)}</li>`)
          .join("")}</ul></div>`;
  const menus =
    report.series.length === 0
      ? "<p>Aucune série dans le dossier des séries.</p>"
      : MENU_ORDER.map((mode) => {
          const versions = report.series.filter(
            (series) => series.recipe.mode === mode,
          );
          return versions.length === 0 ? "" : menuSection(mode, versions);
        }).join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="lead">Chaque ligne est une version de la consigne envoyée à Albert. « Juste » veut dire qu'il donne la même catégorie que l'équipe. « Inconnu bien placé » compte les signalements que l'équipe jugeait indéterminables et où Albert a aussi répondu « inconnu ».</p>
<p class="muted">Généré le ${escapeHtml(report.generatedAt)}. Sur 30 signalements, un écart de moins de 15 points peut être dû au hasard.</p>
${banner}
${notes}
${menus}
<h2>Pour aller plus loin</h2>
<p class="muted">Scores par catégorie, confusions et consignes complètes, version par version.</p>
${report.series.map(seriesDetails).join("\n")}
</body>
</html>
`;
}
