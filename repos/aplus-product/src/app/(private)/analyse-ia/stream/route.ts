import prisma from "@/lib/prisma";
import { AlbertQuotaError } from "@/lib/ai/providers";
import { runPipeline } from "@/lib/ai/pipeline";
import type { PipelineResult } from "@/lib/ai/pipeline";
import { checkNoPii } from "@/lib/ai/guards/no-pii";
import { summarizeTagStep } from "@/lib/ai/steps/summarize-tag";
import { TAG_AXES, type TagAxis } from "@/lib/ai/tag-axes";
import { PII_TYPES } from "@/types/ai-pipeline";
import {
  createUsageTotals,
  runWithUsage,
  type UsageTotals,
} from "@/lib/ai/usage";
import { getCurrentUserRole } from "@/utils/auth-server";
import { createLogger } from "@/utils/logger";
import { USER_ROLES } from "@/constants/user-roles";

const logger = createLogger("analyse-ia");

export const dynamic = "force-dynamic";

/**
 * Lance l'analyse d'un échantillon de signalements et streame le résultat en
 * NDJSON (une ligne JSON par événement). Pour chaque signalement :
 * pseudonymisation (couches A + B du pipeline) puis résumé + tags LIBRES en un
 * seul appel LLM (le modèle propose ses propres libellés — la taxonomie n'est
 * pas encore figée).
 *
 * Réservé aux admins. READ-ONLY : ne fait que lire les signalements.
 */

interface RequestBody {
  count?: number;
  // Ids déjà analysés à exclure : permet d'empiler les runs sans re-analyser
  // (ni re-payer) les signalements déjà traités.
  excludeIds?: string[];
  // Libellés déjà émergés (par axe) : réinjectés dans le prompt de tagage pour
  // que le modèle les réutilise au lieu d'inventer des variantes.
  knownLabels?: Partial<Record<TagAxis, string[]>>;
}

// Ne garde du payload client que des libellés plausibles (chaînes courtes, axes
// connus, volume borné) : le prompt n'est pas un endroit où laisser passer du
// contenu arbitraire.
function sanitizeKnownLabels(
  raw: RequestBody["knownLabels"],
): Partial<Record<TagAxis, string[]>> {
  const result: Partial<Record<TagAxis, string[]>> = {};
  for (const axis of TAG_AXES) {
    const labels = (raw?.[axis] ?? [])
      .filter(
        (label) =>
          typeof label === "string" && label.length > 0 && label.length <= 40,
      )
      .slice(0, 30);
    if (labels.length > 0) result[axis] = labels;
  }
  return result;
}

interface SampledReport {
  id: string;
  createdAt: Date;
  subject: string;
  description: string;
  firstName: string | null;
  lastName: string | null;
  maritalName: string | null;
}

async function analyzeOne(
  report: SampledReport,
  knownLabels: Partial<Record<TagAxis, string[]>>,
  onStep: (step: string) => void,
) {
  const identity = {
    firstName: report.firstName,
    lastName: report.lastName,
    maritalName: report.maritalName,
  };

  let result: PipelineResult | undefined;
  for await (const event of runPipeline(
    { subject: report.subject, description: report.description },
    identity,
    // Le pipeline ne sert ici qu'à la pseudonymisation (couches A + B) : le
    // résumé et les tags sont produits par le step combiné ci-dessous, en UN
    // appel LLM — le quota Albert se compte en requêtes/jour. Total : 2 appels
    // par signalement (extract-names + summarize-tag) au lieu de 3.
    { skip: ["summary", "oneline", "tags"] },
  )) {
    if (event.type === "step" && event.status === "running") {
      onStep(event.step);
    }
    if (event.type === "result") result = event.result;
    if (event.type === "error") throw new Error(event.message);
  }
  if (!result) throw new Error("pipeline terminé sans résultat");

  const pseudoText = {
    subject: result.pseudonymized.subject,
    description: result.pseudonymized.description,
  };

  onStep("summarize-tag");
  let { summary, tags } = await summarizeTagStep.run({
    ...pseudoText,
    knownLabels,
  });

  // Guard PII (local, aucun appel LLM) : le pipeline ne l'exécute plus quand
  // `summary` est sauté — même contrôle et même politique de régénération
  // qu'en pipeline complet, tags inclus. Les noms de la couche B sont dans les
  // matches de pseudonymisation.
  const names = result.pseudonymized.matches
    .filter((match) => match.type === PII_TYPES.NAME)
    .map((match) => match.value);
  const guardText = () =>
    `${summary}\n${tags.map((tag) => tag.label).join("\n")}`;
  let guard = checkNoPii(guardText(), identity, names);
  if (!guard.ok) {
    onStep("summarize-tag");
    ({ summary, tags } = await summarizeTagStep.run({
      ...pseudoText,
      knownLabels,
    }));
    guard = checkNoPii(guardText(), identity, names);
  }

  return {
    subject: result.pseudonymized.subject.slice(0, 200),
    summary,
    tags,
    guardOk: guard.ok,
  };
}

async function sampleReports(
  count: number,
  excludeIds: string[],
): Promise<SampledReport[]> {
  const idRows = await prisma.report.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  // Pool des signalements pas encore analysés : garantit qu'un nouveau run
  // apporte des signalements NEUFS (empilement, sans doublon ni re-paiement).
  const excludeSet = new Set(excludeIds);
  const available = idRows.map((r) => r.id).filter((id) => !excludeSet.has(id));

  const take = Math.min(count, available.length);
  const step = Math.max(1, Math.floor(available.length / Math.max(take, 1)));
  const pickedIds: string[] = [];
  for (let i = 0; i < available.length && pickedIds.length < take; i += step) {
    pickedIds.push(available[i]);
  }

  return prisma.report.findMany({
    where: { id: { in: pickedIds } },
    select: {
      id: true,
      createdAt: true,
      subject: true,
      description: true,
      firstName: true,
      lastName: true,
      maritalName: true,
    },
  });
}

export async function POST(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== USER_ROLES.ADMIN) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json()) as RequestBody;
  const count = Math.min(Math.max(Number(body.count ?? 25), 1), 1000);
  const knownLabels = sanitizeKnownLabels(body.knownLabels);
  const reports = await sampleReports(count, body.excludeIds ?? []);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Client parti (rechargement, veille, réseau) : `enqueue` jette. On
      // arrête alors le run — continuer brûlerait des tokens que personne ne
      // recevra (les résultats ne vivent que dans le localStorage du client).
      let closed = false;
      function send(event: unknown) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      }

      logger.info("run démarré", { count: reports.length });
      let processed = 0;
      try {
        send({ type: "start", total: reports.length });
        for (const report of reports) {
          if (closed || request.signal.aborted) {
            logger.info("run interrompu par le client", {
              processed,
              total: reports.length,
            });
            break;
          }
          // Un accumulateur par signalement : l'usage est envoyé au client
          // même en cas d'échec (les tokens des étapes réussies avant l'échec
          // ont été facturés).
          const usage: UsageTotals = createUsageTotals();
          try {
            const analysis = await runWithUsage(usage, () =>
              analyzeOne(report, knownLabels, (step) =>
                send({ type: "step", id: report.id, step }),
              ),
            );
            send({
              type: "item",
              id: report.id,
              createdAt: report.createdAt.toISOString(),
              ...analysis,
              usage,
            });
          } catch (error) {
            logger.error("analyse d'un signalement échouée", {
              reportId: report.id,
              error,
            });
            send({
              type: "item-error",
              id: report.id,
              message:
                error instanceof Error ? error.message : "Erreur inconnue.",
              usage,
            });
            // Quota épuisé : les signalements suivants sont condamnés au même
            // 429. On arrête le run au lieu de griller ~5 min de retries par
            // signalement pour rien — ils restent dans le pool du prochain run.
            if (error instanceof AlbertQuotaError) {
              logger.error("run arrêté : quota Albert épuisé", {
                processed,
                total: reports.length,
              });
              send({
                type: "aborted",
                message:
                  `Run arrêté à ${processed + 1} / ${reports.length} : quota Albert épuisé. ` +
                  "Relance plus tard — les signalements non traités restent dans le pool, rien n'est re-payé.",
              });
              return;
            }
          }
          processed++;
          send({ type: "progress", processed, total: reports.length });
        }
        send({ type: "done", processed });
        logger.info("run terminé", { processed, total: reports.length });
      } catch (error) {
        // Filet de sécurité : sans lui, une erreur hors des try par item
        // tuerait le flux sans une ligne de log ni d'événement client.
        logger.error("run interrompu par une erreur", { processed, error });
        send({
          type: "item-error",
          id: "run",
          message: error instanceof Error ? error.message : "Erreur inconnue.",
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // flux déjà fermé côté client
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
