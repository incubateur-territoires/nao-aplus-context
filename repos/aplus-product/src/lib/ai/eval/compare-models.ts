import type { UsageTotals } from "../usage";
import { DETECTION_LAYERS, type PiiEvalCase } from "./pii-corpus";
import {
  isMissed,
  percent,
  scoreByCategory,
  summarizeScores,
  type CaseScore,
} from "./score";

/**
 * Comparaison de plusieurs modèles sur le même corpus. Les couches
 * déterministes donnent le même résultat quel que soit le modèle : seules les
 * PII annotées `LLM`, le sens détruit et les refus du juge les départagent.
 */

export interface ModelRun {
  model: string;
  scores: CaseScore[];
  /** Labels des cas que le juge a refusé de valider. */
  refused: string[];
  usage: UsageTotals;
}

/** Même règle que le run d'un seul modèle : un refus vaut une fuite. */
export function hasFailed(run: ModelRun): boolean {
  const totals = summarizeScores(run.scores);
  return totals.missed > 0 || totals.destroyed > 0 || run.refused.length > 0;
}

interface Outcome {
  label: string;
  /** Une entrée par run, dans l'ordre des runs : `true` en cas d'échec. */
  failed: boolean[];
}

function llmItemOutcomes(cases: PiiEvalCase[], runs: ModelRun[]): Outcome[] {
  return cases.flatMap((evalCase) =>
    evalCase.mustRedact
      .filter((expected) => expected.layer === DETECTION_LAYERS.LLM)
      .map((expected) => ({
        label: `[${expected.category}] ${expected.value} · ${evalCase.label}`,
        failed: runs.map((run) =>
          isMissed(
            run.scores.find((score) => score.case === evalCase.label),
            expected,
          ),
        ),
      })),
  );
}

function destroyedOutcomes(cases: PiiEvalCase[], runs: ModelRun[]): Outcome[] {
  return cases.flatMap((evalCase) =>
    evalCase.mustPreserve
      .map((fragment) => ({
        label: `« ${fragment} » · ${evalCase.label}`,
        failed: runs.map(
          (run) =>
            run.scores
              .find((score) => score.case === evalCase.label)
              ?.destroyed.includes(fragment) ?? false,
        ),
      }))
      .filter((outcome) => outcome.failed.some(Boolean)),
  );
}

const LABEL_WIDTH = 36;
const COLUMN_WIDTH = 14;

function columnName(index: number): string {
  return `M${index + 1}`;
}

function row(label: string, cells: string[]): string {
  return `  ${label.padEnd(LABEL_WIDTH)}${cells.map((cell) => cell.padStart(COLUMN_WIDTH)).join("")}`;
}

function formatLatency(usage: UsageTotals): string {
  if (usage.calls === 0) return "-";
  return `${Math.round(usage.latencyMs / usage.calls)} ms`;
}

function outcomeLines(outcomes: Outcome[], badCell: string): string[] {
  return outcomes.map(
    (outcome) =>
      `  ${outcome.failed.map((bad) => (bad ? badCell : "ok").padEnd(8)).join("")}${outcome.label}`,
  );
}

export function formatModelComparison(
  cases: PiiEvalCase[],
  runs: ModelRun[],
): string {
  const lines: string[] = [];
  const header = runs.map((_, index) => columnName(index));

  lines.push("=== Comparaison des modèles ===", "");
  runs.forEach((run, index) =>
    lines.push(`  ${columnName(index)} = ${run.model}`),
  );

  lines.push("", "Rappel par catégorie de PII", row("", header));
  const categoriesByRun = runs.map((run) => scoreByCategory(cases, run.scores));
  for (const reference of categoriesByRun[0] ?? []) {
    const cells = categoriesByRun.map((categories) => {
      const entry = categories.find(
        (item) =>
          item.category === reference.category &&
          item.layer === reference.layer,
      );
      return entry ? `${entry.redacted}/${entry.expected}` : "-";
    });
    lines.push(row(`${reference.category} (${reference.layer})`, cells));
  }

  const items = llmItemOutcomes(cases, runs);
  const totals = runs.map((run) => summarizeScores(run.scores));
  lines.push("", "Totaux", row("", header));
  lines.push(
    row(
      "rappel global",
      totals.map(
        (total) => `${total.expected - total.missed}/${total.expected}`,
      ),
    ),
  );
  lines.push(
    row(
      "rappel sur les PII dépendant du LLM",
      runs.map((_, index) => {
        const caught = items.filter((item) => !item.failed[index]).length;
        const ratio = items.length === 0 ? 1 : caught / items.length;
        return `${caught}/${items.length} ${percent(ratio)}`;
      }),
    ),
  );
  lines.push(
    row(
      "PII non caviardées",
      totals.map((total) => String(total.missed)),
    ),
  );
  lines.push(
    row(
      "fragments de sens détruits",
      totals.map((total) => String(total.destroyed)),
    ),
  );
  lines.push(
    row(
      "dossiers refusés par le juge",
      runs.map((run) => String(run.refused.length)),
    ),
  );
  lines.push(
    row(
      "appels LLM",
      runs.map((run) => String(run.usage.calls)),
    ),
  );
  lines.push(
    row(
      "latence moyenne par appel",
      runs.map((run) => formatLatency(run.usage)),
    ),
  );
  lines.push(
    row(
      "tokens entrée / sortie",
      runs.map((run) => `${run.usage.inputTokens}/${run.usage.outputTokens}`),
    ),
  );
  lines.push(
    row(
      "verdict",
      runs.map((run) => (hasFailed(run) ? "ÉCHEC" : "ok")),
    ),
  );

  const divergent = items.filter((item) => item.failed.some(Boolean));
  lines.push(
    "",
    `PII dépendant du LLM : ${items.length - divergent.length}/${items.length} caviardées par tous les modèles. Fuites :`,
    `  ${header.map((name) => name.padEnd(8)).join("")}`,
    ...outcomeLines(divergent, "FUITE"),
  );

  const destroyed = destroyedOutcomes(cases, runs);
  lines.push(
    "",
    `Fragments de sens détruits (la couche A n'en détruit aucun, cf. pii-corpus.spec) : ${destroyed.length}`,
    `  ${header.map((name) => name.padEnd(8)).join("")}`,
    ...outcomeLines(destroyed, "DÉTRUIT"),
  );

  const refusedLabels = [...new Set(runs.flatMap((run) => run.refused))];
  lines.push(
    "",
    `Dossiers refusés par le juge : ${refusedLabels.length}`,
    `  ${header.map((name) => name.padEnd(8)).join("")}`,
    ...outcomeLines(
      refusedLabels.map((label) => ({
        label,
        failed: runs.map((run) => run.refused.includes(label)),
      })),
      "REFUS",
    ),
  );

  return lines.join("\n");
}
