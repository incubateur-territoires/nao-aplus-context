import { PrismaClient } from "@/generated/prisma/client";
import {
  ReportPseudonymizationStatus,
  ReportStatus,
} from "@/generated/prisma/enums";
import {
  ERASED_CONTENT,
  ANONYMIZED_IDENTITY,
  generateAnswerContent,
  generateDescription,
  generateSubject,
} from "@/utils/anonymize-report";
import { mapWithConcurrency } from "@/utils/concurrency";
import { deleteFileFromBucket } from "@/utils/s3";
import { createLogger } from "@/utils/logger";
import {
  API_FAILURE_THRESHOLD,
  isPseudonymizationEnabled,
  shouldEraseContent,
} from "@/utils/pseudonymization-policy";
import {
  PSEUDONYMIZATION_OUTCOMES,
  REPORT_CONTENT_SELECT,
  pseudonymizeReportContent,
  type PseudonymizationOutcome,
  type PseudonymizedContent,
} from "./report-pseudonymization";

const logger = createLogger("Report Deletion CRON");

const DAYS_IN_MS = 24 * 60 * 60 * 1000;
const SIX_MONTHS_DAYS = 180;
// Traitement par pages pour borner la mémoire : le tout premier run rattrape
// tout l'historique et charger tous les signalements d'un coup fait exploser la
// heap du conteneur (OOM). On pagine par curseur sur l'id.
const BATCH_SIZE = 50;

/**
 * Plafond de caviardages par exécution. Calé au-dessus du pic de fermetures
 * quotidiennes observé : en dessous, le stock grossirait mécaniquement d'un run
 * à l'autre. Les signalements non traités repassent au run suivant.
 */
const MAX_PSEUDONYMIZATIONS_PER_RUN = 900;

/**
 * Caviardages menés de front. Le fournisseur plafonne les requêtes par minute et
 * chaque dossier en coûte au moins deux. À 4, un audit sur mille dossiers réels
 * a épuisé ses tentatives sur des 429 ; à 2, le run reste bien plus court qu'en
 * séquentiel sans saturer le plafond.
 */
export const REDACTION_CONCURRENCY = 2;

/**
 * Le défaut de Prisma (5 s) ne suffit pas à un long fil d'échanges : dépassé à
 * chaque run, le signalement ne serait jamais supprimé.
 */
const TRANSACTION_OPTIONS = { timeout: 30_000 };

export interface ReportDeletionInfo {
  id: string;
}

export interface ReportDeletionResult {
  reportsDeleted: ReportDeletionInfo[];
  /** Texte réel conservé sous forme caviardée. */
  pseudonymized: ReportDeletionInfo[];
  /** Masqués et parcourus pendant ce run, texte réel encore présent. */
  awaitingPseudonymization: ReportDeletionInfo[];
  /**
   * Stock total de signalements masqués restant à caviarder, relu en base à la
   * fin du run. La liste ci-dessus ne compte que les dossiers parcourus : après
   * un arrêt anticipé, elle sous-estimerait l'ampleur dans l'alerte.
   */
  awaitingPseudonymizationCount: number;
  /** Texte remplacé : faux texte ou marqueur après renoncement. */
  contentErased: ReportDeletionInfo[];
  /** Rouverts (ou refermés récemment) entre la lecture et l'écriture : épargnés. */
  skipped: ReportDeletionInfo[];
  fileErrors: { reportId: string; fileId: string; error: string }[];
  errors: { reportId: string; error: string }[];
  /** Le fournisseur de caviardage a été jugé en panne pendant l'exécution. */
  pseudonymizationOutage: boolean;
  /** Le pipeline était activé sur ce run : sinon les compteurs de texte ne disent rien. */
  pseudonymizationEnabled: boolean;
}

/**
 * Signale, depuis l'intérieur de la transaction, qu'un signalement est redevenu
 * inéligible pendant le run : lever cette erreur annule (rollback) les écritures
 * déjà faites dans la transaction. Ce n'est pas un échec, mais un abandon voulu.
 */
class ReopenedDuringRunError extends Error {}

/** État de l'exécution en cours, partagé par les deux passes. */
interface RunState {
  /** Lu une fois en début de run : le drapeau ne change pas en cours de route. */
  pseudonymizationEnabled: boolean;
  apiFailures: number;
  pseudonymized: number;
  erased: number;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isOutage(state: RunState): boolean {
  return state.apiFailures >= API_FAILURE_THRESHOLD;
}

/** Plus rien à tenter sur ce run : inutile de parcourir le stock restant. */
function shouldStopPseudonymizing(state: RunState): boolean {
  return (
    isOutage(state) || state.pseudonymized >= MAX_PSEUDONYMIZATIONS_PER_RUN
  );
}

function emptyResult(pseudonymizationEnabled: boolean): ReportDeletionResult {
  return {
    reportsDeleted: [],
    pseudonymized: [],
    awaitingPseudonymization: [],
    awaitingPseudonymizationCount: 0,
    contentErased: [],
    skipped: [],
    fileErrors: [],
    errors: [],
    pseudonymizationOutage: false,
    pseudonymizationEnabled,
  };
}

/** Le pipeline n'a pas été sollicité : désactivé, en panne, ou budget épuisé. */
const SKIPPED = "SKIPPED" as const;

interface PseudonymizationStep {
  outcome: PseudonymizationOutcome | typeof SKIPPED;
  content?: PseudonymizedContent;
}

/**
 * Tente le caviardage si le pipeline est activé et si le budget du run le
 * permet. L'issue est rendue telle quelle : seul un REFUS prouve que le pipeline
 * a examiné ce contenu et n'a pas su le traiter, et lui seul peut conduire à
 * renoncer. Une panne ne prouve rien sur le dossier.
 */
async function tryPseudonymize(
  prisma: PrismaClient,
  reportId: string,
  state: RunState,
): Promise<PseudonymizationStep> {
  if (!state.pseudonymizationEnabled) return { outcome: SKIPPED };
  if (isOutage(state)) return { outcome: SKIPPED };
  if (state.pseudonymized >= MAX_PSEUDONYMIZATIONS_PER_RUN) {
    return { outcome: SKIPPED };
  }

  const content = await prisma.report.findUnique({
    where: { id: reportId },
    select: REPORT_CONTENT_SELECT,
  });
  if (!content) return { outcome: SKIPPED };

  const attempt = await pseudonymizeReportContent(reportId, content);

  if (attempt.outcome === PSEUDONYMIZATION_OUTCOMES.OUTAGE) {
    state.apiFailures += 1;
    return { outcome: attempt.outcome };
  }

  // Un refus prouve que le pipeline fonctionne : il rouvre le compteur de panne.
  state.apiFailures = 0;
  if (attempt.outcome === PSEUDONYMIZATION_OUTCOMES.REFUSED) {
    return { outcome: attempt.outcome };
  }

  state.pseudonymized += 1;
  return { outcome: attempt.outcome, content: attempt.content };
}

/**
 * Texte de remplacement quand on renonce à conserver le contenu réel. Les
 * réponses metadata-only en sont exclues par l'appelant : elles ne portent pas
 * le récit, et le traitement historique les a toujours laissées intactes.
 */
function fakeContent(
  answerIds: string[],
  useMarker: boolean,
): PseudonymizedContent {
  return {
    subject: useMarker ? ERASED_CONTENT : generateSubject(),
    description: useMarker ? ERASED_CONTENT : generateDescription(),
    answers: answerIds.map((id) => ({
      id,
      content: useMarker ? ERASED_CONTENT : generateAnswerContent(),
    })),
  };
}

/**
 * Efface les données personnelles des signalements fermés depuis plus de 6 mois.
 *
 * Conformément à l'engagement des CGU (« 6 mois après sa fermeture, le
 * signalement est supprimé »), ce traitement — plutôt qu'un hard delete qui
 * casserait les relations `NOT NULL` `Report.authorId` / `Answer.authorId` —
 * masque le signalement en le passant au statut `DELETED`, supprime ses
 * fichiers du bucket puis leurs lignes en base, et remplace son identité
 * structurée et son texte libre.
 *
 * Le MASQUAGE n'est jamais conditionné au pipeline de caviardage : il a lieu à
 * l'échéance même si le fournisseur est éteint. L'identité et le texte, eux,
 * partent ensemble : le caviardage a besoin de l'identité réelle pour retirer
 * le nom du citoyen du texte, donc tant que le texte attend, l'identité reste.
 *
 * Date de fermeture = `createdAt` de la dernière entrée `ReportStatusHistory`
 * au statut `CLOSED` (il n'existe pas de champ `closedAt`). On ne cible que les
 * signalements actuellement `CLOSED` dont cette dernière fermeture date de plus
 * de 6 mois, ce qui exclut les signalements rouverts puis refermés récemment.
 */
export async function processReportDeletion(
  prisma: PrismaClient,
): Promise<ReportDeletionResult> {
  const pseudonymizationEnabled = isPseudonymizationEnabled();
  const result = emptyResult(pseudonymizationEnabled);
  const state: RunState = {
    pseudonymizationEnabled,
    apiFailures: 0,
    pseudonymized: 0,
    erased: 0,
  };
  // Drapeau éteint, aucun appel réseau par dossier : le séquentiel d'avant suffit.
  const concurrency = pseudonymizationEnabled ? REDACTION_CONCURRENCY : 1;

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - SIX_MONTHS_DAYS * DAYS_IN_MS);

  let cursor: string | undefined;

  // Pagination par curseur : on avance sur l'id même quand une page contient des
  // signalements non éligibles (rouverts), ce qui évite toute boucle infinie.
  for (;;) {
    const page = await prisma.report.findMany({
      where: {
        status: ReportStatus.CLOSED,
        statusHistory: {
          some: {
            status: ReportStatus.CLOSED,
            createdAt: { lte: sixMonthsAgo },
          },
        },
      },
      select: {
        id: true,
        files: { select: { id: true } },
        answers: { select: { id: true, isMetadataOnly: true } },
        statusHistory: {
          where: { status: ReportStatus.CLOSED },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (page.length === 0) break;
    cursor = page[page.length - 1].id;

    // Re-filtrer sur la DERNIÈRE fermeture : un signalement rouvert puis refermé
    // récemment matche `some` (ancienne entrée CLOSED) mais ne doit pas être effacé.
    const reportsToDelete = page.filter((report) => {
      const lastClosedAt = report.statusHistory[0]?.createdAt;
      return lastClosedAt != null && lastClosedAt <= sixMonthsAgo;
    });

    await mapWithConcurrency(reportsToDelete, concurrency, async (report) => {
      try {
        // Le caviardage appelle le réseau : il reste HORS de la transaction, qui
        // ne doit pas rester ouverte le temps de plusieurs appels.
        const step = await tryPseudonymize(prisma, report.id, state).catch(
          (error: unknown): PseudonymizationStep => {
            // Un bug du caviardage ne retarde pas le masquage, qui est dû à
            // l'échéance : le texte attend, l'erreur est consignée.
            result.errors.push({
              reportId: report.id,
              error: toMessage(error),
            });
            logger.error("Erreur inattendue du caviardage", {
              reportId: report.id,
              error,
            });
            return { outcome: SKIPPED };
          },
        );
        const pseudonymized = step.content ?? null;
        const content =
          pseudonymized ??
          (pseudonymizationEnabled
            ? null
            : fakeContent(
                report.answers
                  .filter((answer) => !answer.isMetadataOnly)
                  .map((answer) => answer.id),
                false,
              ));

        const notificationTargetIds = [
          report.id,
          ...report.answers.map((answer) => answer.id),
        ];

        // Masquage + purge des fichiers et des vues, et si le texte est prêt,
        // texte et identité, en une transaction. L'éligibilité est REVÉRIFIÉE
        // ici, au moment de l'écriture : le run peut durer des heures et un
        // signalement lu au début de la boucle a pu être rouvert entre-temps.
        // Sans cette garde, on écraserait un dossier redevenu actif — de façon
        // irréversible.
        const filesToDelete = await prisma.$transaction(async (tx) => {
          // `updateMany` avec le statut dans le `where` est la garde atomique :
          // Postgres verrouille la ligne puis réévalue le prédicat, donc si le
          // signalement n'est plus `CLOSED`, aucune ligne n'est touchée.
          const updated = await tx.report.updateMany({
            where: { id: report.id, status: ReportStatus.CLOSED },
            data: {
              status: ReportStatus.DELETED,
              ...(content
                ? contentData(
                    content,
                    pseudonymized
                      ? ReportPseudonymizationStatus.DONE
                      : ReportPseudonymizationStatus.FAKE,
                  )
                : {}),
            },
          });

          if (updated.count === 0) return null;

          // Rouvert PUIS refermé récemment : le signalement est de nouveau
          // `CLOSED`, donc l'`updateMany` ci-dessus passe, mais sa dernière
          // fermeture n'a plus 6 mois. On annule tout.
          const lastClosed = await tx.reportStatusHistory.findFirst({
            where: { reportId: report.id, status: ReportStatus.CLOSED },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          });

          if (lastClosed == null || lastClosed.createdAt > sixMonthsAgo) {
            throw new ReopenedDuringRunError();
          }

          for (const answer of content?.answers ?? []) {
            await tx.answer.update({
              where: { id: answer.id },
              data: { content: answer.content },
            });
          }

          await tx.reportStatusHistory.create({
            data: { reportId: report.id, status: ReportStatus.DELETED },
          });
          await tx.file.deleteMany({ where: { reportId: report.id } });
          await tx.notificationView.deleteMany({
            where: { targetId: { in: notificationTargetIds } },
          });

          return report.files.map((file) => file.id);
        }, TRANSACTION_OPTIONS);

        if (filesToDelete == null) {
          result.skipped.push({ id: report.id });
          logger.info("Signalement rouvert pendant le run, ignoré", {
            reportId: report.id,
          });
          return;
        }

        // Suppression des objets S3 APRÈS le commit : tant que la base n'a pas
        // confirmé le masquage, on ne détruit rien d'irrécupérable sur le
        // bucket. Best-effort : une erreur sur un fichier ne remet pas en cause
        // le masquage, déjà acté.
        for (const fileId of filesToDelete) {
          try {
            await deleteFileFromBucket(fileId);
          } catch (error) {
            result.fileErrors.push({
              reportId: report.id,
              fileId,
              error: toMessage(error),
            });
            logger.error("S3 delete error", {
              fileId,
              reportId: report.id,
              error,
            });
          }
        }

        result.reportsDeleted.push({ id: report.id });
        if (pseudonymized) {
          result.pseudonymized.push({ id: report.id });
        } else if (content) {
          result.contentErased.push({ id: report.id });
        } else {
          result.awaitingPseudonymization.push({ id: report.id });
        }
      } catch (error) {
        if (error instanceof ReopenedDuringRunError) {
          result.skipped.push({ id: report.id });
          logger.info("Signalement refermé récemment pendant le run, ignoré", {
            reportId: report.id,
          });
          return;
        }

        result.errors.push({ reportId: report.id, error: toMessage(error) });
        logger.error("Error deleting report", { reportId: report.id, error });
      }
    });
  }

  if (!pseudonymizationEnabled) return result;

  await resumePendingPseudonymization(prisma, result, state, now);

  result.awaitingPseudonymizationCount = await prisma.report.count({
    where: {
      status: ReportStatus.DELETED,
      pseudonymizationStatus: null,
    },
  });
  result.pseudonymizationOutage = isOutage(state);
  return result;
}

/**
 * Seconde passe : les signalements déjà masqués dont le texte attend toujours
 * d'être caviardé. Le stock se résorbe de lui-même dès que le fournisseur
 * répond de nouveau ; passé le délai de grâce, on renonce et on remplace le
 * texte par un marqueur.
 */
async function resumePendingPseudonymization(
  prisma: PrismaClient,
  result: ReportDeletionResult,
  state: RunState,
  now: Date,
): Promise<void> {
  let cursor: string | undefined;

  for (;;) {
    const page = await prisma.report.findMany({
      where: {
        status: ReportStatus.DELETED,
        pseudonymizationStatus: null,
      },
      select: {
        id: true,
        answers: { select: { id: true, isMetadataOnly: true } },
        statusHistory: {
          where: { status: ReportStatus.DELETED },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (page.length === 0) break;
    cursor = page[page.length - 1].id;

    await mapWithConcurrency(page, REDACTION_CONCURRENCY, async (report) => {
      // Rien ne sera plus tenté : inutile de parcourir le stock restant.
      if (shouldStopPseudonymizing(state)) return;

      try {
        const step = await tryPseudonymize(prisma, report.id, state);

        if (!step.content) {
          // Seul un refus autorise à renoncer : une panne ou un budget épuisé
          // ne disent rien de ce dossier, et ne doivent rien détruire.
          const refused = step.outcome === PSEUDONYMIZATION_OUTCOMES.REFUSED;
          const erase =
            refused &&
            shouldEraseContent({
              maskedAt: report.statusHistory[0]?.createdAt ?? null,
              now,
              outage: isOutage(state),
              erasedThisRun: state.erased,
            });

          if (!erase) {
            result.awaitingPseudonymization.push({ id: report.id });
            return;
          }

          state.erased += 1;
          await writeContent(
            prisma,
            report.id,
            fakeContent(
              report.answers
                .filter((answer) => !answer.isMetadataOnly)
                .map((answer) => answer.id),
              true,
            ),
            ReportPseudonymizationStatus.FAKE,
          );
          result.contentErased.push({ id: report.id });
          logger.info("Caviardage abandonné, contenu remplacé", {
            reportId: report.id,
          });
          return;
        }

        await writeContent(
          prisma,
          report.id,
          step.content,
          ReportPseudonymizationStatus.DONE,
        );
        result.pseudonymized.push({ id: report.id });
      } catch (error) {
        result.errors.push({ reportId: report.id, error: toMessage(error) });
        logger.error("Error pseudonymizing report", {
          reportId: report.id,
          error,
        });
      }
    });

    if (shouldStopPseudonymizing(state)) break;
  }
}

/** Texte et identité s'écrivent d'un bloc : l'un ne part jamais sans l'autre. */
function contentData(
  content: PseudonymizedContent,
  status: ReportPseudonymizationStatus,
) {
  return {
    ...ANONYMIZED_IDENTITY,
    subject: content.subject,
    description: content.description,
    pseudonymizationStatus: status,
  };
}

/**
 * Écrit le texte et l'identité d'un signalement déjà masqué. Le statut reste
 * dans le `where` : un signalement ne redevient jamais actif depuis `DELETED`,
 * mais l'écriture ne peut pas non plus tomber sur autre chose.
 */
async function writeContent(
  prisma: PrismaClient,
  reportId: string,
  content: PseudonymizedContent,
  status: ReportPseudonymizationStatus,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.report.updateMany({
      where: { id: reportId, status: ReportStatus.DELETED },
      data: contentData(content, status),
    });

    for (const answer of content.answers) {
      await tx.answer.update({
        where: { id: answer.id },
        data: { content: answer.content },
      });
    }
  }, TRANSACTION_OPTIONS);
}
