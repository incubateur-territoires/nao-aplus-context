import {
  PII_TYPES,
  type CitizenIdentity,
  type GuardResult,
  type PiiMatch,
  type PipelineInput,
} from "@/types/ai-pipeline";
import { pseudonymizeReport, redactNames } from "./pseudonymize";
import { extractNamesStep } from "./steps/extract-names";
import { summarizeStep } from "./steps/summarize";
import { onelineSummaryStep } from "./steps/summarize-oneline";
import { tagStep, type TagOutput } from "./steps/tag";
import { checkNoPii } from "./guards/no-pii";

/**
 * Orchestrateur du pipeline IA de résumé des signalements.
 *
 * Enchaîne, dans l'ordre : pseudonymisation (couche A, locale) → résumé →
 * résumé court → tagage → guardrail anti-PII. Implémenté en générateur
 * asynchrone : chaque étape émet un événement `running` puis `done`, ce qui
 * permet d'afficher une progression côté UI sans changer la logique.
 */

export const PIPELINE_STEPS = [
  "pseudonymize",
  "names",
  "summary",
  "oneline",
  "tags",
  "guard",
] as const;

export type PipelineStepName = (typeof PIPELINE_STEPS)[number];

export interface PipelineResult {
  pseudonymized: { subject: string; description: string; matches: PiiMatch[] };
  summary: string;
  oneLine: string;
  tags: TagOutput;
  guard: GuardResult;
}

export type PipelineEvent =
  | { type: "step"; step: PipelineStepName; status: "running" | "done" }
  | { type: "result"; result: PipelineResult }
  | { type: "error"; message: string };

export interface PipelineOptions {
  /**
   * Étapes à sauter quand l'appelant n'exploite pas leur sortie — chaque étape
   * est un appel LLM facturé. Les sorties sautées valent `""` / listes vides ;
   * les événements des étapes sautées ne sont pas émis. Sauter `summary`
   * désactive aussi le guard (rien à contrôler) : l'appelant qui produit son
   * propre résumé doit exécuter `checkNoPii` lui-même.
   */
  skip?: ReadonlyArray<"oneline" | "tags" | "summary">;
}

/**
 * Nombre de régénérations tentées si le guardrail détecte une PII résiduelle.
 * Utile surtout contre une PII hallucinée par le LLM ; sans effet si la couche A
 * a laissé passer une PII en entrée (le texte fautif est alors déjà transmis).
 */
const MAX_GUARD_RETRIES = 1;

export async function* runPipeline(
  input: PipelineInput,
  identity?: CitizenIdentity,
  options?: PipelineOptions,
): AsyncGenerator<PipelineEvent> {
  const skip = new Set(options?.skip ?? []);
  // Couche A : caviardage déterministe (numéros + nom du citoyen connu).
  yield { type: "step", step: "pseudonymize", status: "running" };
  const coucheA = pseudonymizeReport(input, identity);
  yield { type: "step", step: "pseudonymize", status: "done" };

  // Couche B : le LLM extrait les noms restants (mal orthographiés, tiers),
  // qu'on caviarde ensuite de façon déterministe en continuant la numérotation.
  yield { type: "step", step: "names", status: "running" };
  const { names } = await extractNamesStep.run({
    subject: coucheA.subject,
    description: coucheA.description,
  });
  const nameCount = coucheA.matches.filter(
    (match) => match.type === PII_TYPES.NAME,
  ).length;
  const coucheB = redactNames(
    { subject: coucheA.subject, description: coucheA.description },
    names,
    nameCount,
  );
  const pseudoText = {
    subject: coucheB.subject,
    description: coucheB.description,
  };
  const matches = [...coucheA.matches, ...coucheB.matches];
  yield { type: "step", step: "names", status: "done" };

  let summary = "";
  if (!skip.has("summary")) {
    yield { type: "step", step: "summary", status: "running" };
    summary = (await summarizeStep.run(pseudoText)).summary;
    yield { type: "step", step: "summary", status: "done" };
  }

  let oneLine = "";
  if (!skip.has("oneline")) {
    yield { type: "step", step: "oneline", status: "running" };
    oneLine = (await onelineSummaryStep.run(pseudoText)).line;
    yield { type: "step", step: "oneline", status: "done" };
  }

  let tags: TagOutput = { themes: [], natures: [] };
  if (!skip.has("tags")) {
    yield { type: "step", step: "tags", status: "running" };
    tags = await tagStep.run(pseudoText);
    yield { type: "step", step: "tags", status: "done" };
  }

  // Sans résumé, le guard n'a rien à contrôler : l'appelant qui produit son
  // propre texte (cf. summarizeTagStep) exécute checkNoPii de son côté.
  let guard: GuardResult = { ok: true, violations: [] };
  if (!skip.has("summary")) {
    yield { type: "step", step: "guard", status: "running" };
    guard = checkNoPii(`${oneLine}\n${summary}`, identity, names);
    for (let attempt = 0; !guard.ok && attempt < MAX_GUARD_RETRIES; attempt++) {
      summary = (await summarizeStep.run(pseudoText)).summary;
      if (!skip.has("oneline")) {
        oneLine = (await onelineSummaryStep.run(pseudoText)).line;
      }
      guard = checkNoPii(`${oneLine}\n${summary}`, identity, names);
    }
    yield { type: "step", step: "guard", status: "done" };
  }

  yield {
    type: "result",
    result: {
      pseudonymized: {
        subject: coucheB.subject,
        description: coucheB.description,
        matches,
      },
      summary,
      oneLine,
      tags,
      guard,
    },
  };
}
