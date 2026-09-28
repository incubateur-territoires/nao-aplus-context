import type { EvalRecipe } from "./golden-dataset-eval-run";
import {
  comparisonRows,
  escapeHtml,
  formatProportion,
  renderReportHtml,
  renderReportText,
  type EvalReport,
  type ReportSeries,
  seriesLabel,
} from "./golden-dataset-eval-report";
import { scoreRun, wilson } from "./golden-dataset-scoring";
import {
  OTHER_DEFINITION,
  UNDETERMINED_DEFINITION,
  type ClosedTaxonomy,
} from "./golden-dataset-taxonomy";

const TAXONOMY: ClosedTaxonomy = {
  version: 1,
  axes: {
    blockageTag: [
      { tag: "retard", definition: "d", examples: [] },
      OTHER_DEFINITION,
      UNDETERMINED_DEFINITION,
    ],
    procedureTag: [
      { tag: "RSA", definition: "d", examples: [] },
      OTHER_DEFINITION,
      UNDETERMINED_DEFINITION,
    ],
  },
  projection: { blockageTag: [], procedureTag: [] },
};

const RECIPE: EvalRecipe = {
  model: "modele<script>",
  mode: "closed",
  taxonomyVersion: 1,
  systemPrompt: "Consigne avec <balise> & « guillemets »",
  userTemplate: "{{subject}}",
  promptHash: "0123456789abcdef",
  temperature: 0.2,
  createdAt: "2026-09-24T10:00:00.000Z",
  note: null,
};

const ITEMS = ["i1", "i2", "i3", "i4"].map((id) => ({
  id,
  split: "tuning" as const,
  fineGolds: { blockageTag: "retard", procedureTag: "rsa" },
  closedGolds: { blockageTag: "retard", procedureTag: "RSA" },
  annotatorTags: { blockageTag: ["retard"], procedureTag: ["rsa"] },
}));

const SCORES = scoreRun(
  ITEMS,
  [
    { itemId: "i1", blockageTag: "retard", procedureTag: "RSA" },
    { itemId: "i2", blockageTag: "retard", procedureTag: "RSA" },
    { itemId: "i3", blockageTag: "autre", procedureTag: null },
  ],
  { kind: "closed" },
  TAXONOMY,
).tuning;

const SERIES: ReportSeries = {
  fileName: "closed_modele_0123456789ab_t0.2.json",
  recipe: RECIPE,
  promptIsCurrent: false,
  scores: SCORES,
};

const REPORT: EvalReport = {
  split: "tuning",
  generatedAt: "2026-09-24 12:00",
  series: [SERIES],
  notes: ["1 ligne <orpheline>"],
};

describe("seriesLabel", () => {
  it("place la note de version en tête", () => {
    const label = seriesLabel({
      ...SERIES,
      recipe: { ...RECIPE, note: "v2 : inconnu" },
    });

    expect(label.startsWith("v2 : inconnu · liste fermée")).toBe(true);
  });
});

describe("escapeHtml", () => {
  it("neutralise les cinq caractères actifs", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("formatProportion", () => {
  it("donne le taux, l'intervalle et l'effectif", () => {
    expect(formatProportion(wilson(3, 4))).toBe("75 % [30 %-95 %] 3/4");
  });

  it("marque l'absence de données", () => {
    expect(formatProportion(null)).toBe("n/a");
  });
});

describe("comparisonRows", () => {
  const rows = comparisonRows(REPORT);

  it("commence par la couverture", () => {
    expect(rows[0]).toEqual({
      axis: null,
      metric: "Couverture",
      cells: ["3/4 (75 %)"],
    });
  });

  it("n'a pas de score de libellés en liste fermée", () => {
    const row = rows.find(
      (r) => r.axis === "blockageTag" && r.metric === "Libellés, exacte",
    );
    expect(row?.cells).toEqual(["n/a"]);
  });

  it("donne l'exactitude fermée et l'abstention par axe", () => {
    const closed = rows.find(
      (r) => r.axis === "blockageTag" && r.metric === "Tags fermés, exacte",
    );
    const abstention = rows.find(
      (r) => r.axis === "procedureTag" && r.metric === "Abstention",
    );
    expect(closed?.cells[0]).toMatch(/^67 % .* 2\/3$/);
    expect(abstention?.cells).toEqual(["1/3 (33 %)"]);
  });
});

describe("renderReportText", () => {
  const text = renderReportText(REPORT);

  it("annonce le sous-ensemble et nomme chaque série", () => {
    expect(text).toMatch(/^=== Mise au point/);
    expect(text).toContain(
      "S1 : liste fermée · modele<script> · t=0.2 · 01234567 (consigne ancienne)",
    );
  });

  it("détaille les tags et les confusions", () => {
    expect(text).toContain("--- S1 · Blocage ---");
    expect(text).toMatch(/retard\s+3/);
    expect(text).toMatch(/retard\s+autre\s+1/);
  });

  it("annonce l'examen en tête", () => {
    expect(renderReportText({ ...REPORT, split: "test" })).toMatch(
      /^=== EXAMEN/,
    );
  });
});

describe("renderReportHtml", () => {
  const html = renderReportHtml(REPORT);

  it("échappe tout texte venu des fichiers", () => {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<balise>");
    expect(html).not.toContain("<orpheline>");
    expect(html).toContain("modele&lt;script&gt;");
    expect(html).toContain("Consigne avec &lt;balise&gt; &amp; « guillemets »");
  });

  it("est autonome : styles en ligne, aucune ressource externe", () => {
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("<style>");
    expect(html).not.toMatch(/<script|<link|src=/);
  });

  it("replie le détail de chaque série", () => {
    expect(html).toContain("<details>\n<summary>S1 · liste fermée");
    expect(html).toContain("n'est plus celle du code");
  });

  it("ne montre le bandeau d'examen qu'à l'examen", () => {
    expect(html).not.toContain('class="exam"');
    expect(renderReportHtml({ ...REPORT, split: "test" })).toContain(
      'class="exam"',
    );
  });

  it("montre par menu ce qui a changé d'une version de consigne à la suivante", () => {
    const v2: ReportSeries = {
      ...SERIES,
      recipe: {
        ...RECIPE,
        note: "v2 : nouvelle règle",
        systemPrompt: `${RECIPE.systemPrompt}\nRègle <ajoutée>`,
        createdAt: "2026-09-25T10:00:00.000Z",
      },
    };
    const page = renderReportHtml({ ...REPORT, series: [SERIES, v2] });

    expect(page).toContain("<h2>Menu des catégories</h2>");
    expect(page).toContain("→ v2 : nouvelle règle</h4>");
    expect(page).toContain('<span class="add">+ Règle &lt;ajoutée&gt;</span>');
  });

  it("masque les séries sans prédiction sur le sous-ensemble", () => {
    const empty: ReportSeries = {
      ...SERIES,
      recipe: { ...RECIPE, note: "jamais passée" },
      scores: { ...SERIES.scores, predicted: 0 },
    };

    expect(
      renderReportHtml({ ...REPORT, series: [SERIES, empty] }),
    ).not.toContain("jamais passée");
  });

  it("dit quand il n'y a aucune série", () => {
    expect(renderReportHtml({ ...REPORT, series: [] })).toContain(
      "Aucune série",
    );
  });
});
