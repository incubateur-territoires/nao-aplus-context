import { PrismaClient } from "@/generated/prisma/client";
import { ReportStatus } from "@/generated/prisma/enums";
import {
  buildAnonymizedReportData,
  generateAnswerContent,
} from "@/utils/anonymize-report";
import { deleteFileFromBucket } from "@/utils/s3";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Report Deletion CRON");

const DAYS_IN_MS = 24 * 60 * 60 * 1000;
const SIX_MONTHS_DAYS = 180;
// Traitement par pages pour borner la mémoire : le tout premier run rattrape
// tout l'historique et charger tous les signalements d'un coup fait exploser la
// heap du conteneur (OOM). On pagine par curseur sur l'id.
const BATCH_SIZE = 50;

export interface ReportDeletionInfo {
  id: string;
}

export interface ReportDeletionResult {
  reportsDeleted: ReportDeletionInfo[];
  /** Rouverts (ou refermés récemment) entre la lecture et l'écriture : épargnés. */
  skipped: ReportDeletionInfo[];
  fileErrors: { reportId: string; fileId: string; error: string }[];
  errors: { reportId: string; error: string }[];
}

/**
 * Signale, depuis l'intérieur de la transaction, qu'un signalement est redevenu
 * inéligible pendant le run : lever cette erreur annule (rollback) les écritures
 * déjà faites dans la transaction. Ce n'est pas un échec, mais un abandon voulu.
 */
class ReopenedDuringRunError extends Error {}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Efface les données personnelles des signalements fermés depuis plus de 6 mois.
 *
 * Conformément à l'engagement des CGU (« 6 mois après sa fermeture, le
 * signalement est supprimé »), ce traitement — plutôt qu'un hard delete qui
 * casserait les relations `NOT NULL` `Report.authorId` / `Answer.authorId` —
 * anonymise en place les PII du `Report` et des `Answer`, passe le signalement
 * au statut `DELETED` (donc invisible partout dans l'UI), supprime les fichiers
 * joints du bucket S3 puis leurs lignes en base. L'intégrité référentielle et
 * les statistiques agrégées sont préservées.
 *
 * Date de fermeture = `createdAt` de la dernière entrée `ReportStatusHistory`
 * au statut `CLOSED` (il n'existe pas de champ `closedAt`). On ne cible que les
 * signalements actuellement `CLOSED` dont cette dernière fermeture date de plus
 * de 6 mois, ce qui exclut les signalements rouverts puis refermés récemment.
 */
export async function processReportDeletion(
  prisma: PrismaClient,
): Promise<ReportDeletionResult> {
  const result: ReportDeletionResult = {
    reportsDeleted: [],
    skipped: [],
    fileErrors: [],
    errors: [],
  };

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
        birthDate: true,
        phone: true,
        nir: true,
        caf: true,
        nif: true,
        maritalName: true,
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

    for (const report of reportsToDelete) {
      try {
        const anonymized = buildAnonymizedReportData({
          birthDate: report.birthDate,
          phone: report.phone,
          nir: report.nir,
          caf: report.caf,
          nif: report.nif,
          maritalName: report.maritalName,
        });

        const answersToAnonymize = report.answers.filter(
          (answer) => !answer.isMetadataOnly,
        );
        const notificationTargetIds = [
          report.id,
          ...report.answers.map((answer) => answer.id),
        ];

        // 1. Anonymisation + statut DELETED + trace historique + suppression des
        //    lignes File et des vues de notification liées, en une transaction.
        //
        //    L'éligibilité est REVÉRIFIÉE ici, au moment de l'écriture : le run
        //    peut durer des heures et un signalement lu au début de la boucle a
        //    pu être rouvert entre-temps. Sans cette garde, on écraserait un
        //    dossier redevenu actif — de façon irréversible.
        const filesToDelete = await prisma.$transaction(async (tx) => {
          // `updateMany` avec le statut dans le `where` est la garde atomique :
          // Postgres verrouille la ligne puis réévalue le prédicat, donc si le
          // signalement n'est plus `CLOSED`, aucune ligne n'est touchée.
          const updated = await tx.report.updateMany({
            where: { id: report.id, status: ReportStatus.CLOSED },
            data: { ...anonymized, status: ReportStatus.DELETED },
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

          for (const answer of answersToAnonymize) {
            await tx.answer.update({
              where: { id: answer.id },
              data: { content: generateAnswerContent() },
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
        });

        if (filesToDelete == null) {
          result.skipped.push({ id: report.id });
          logger.info("Signalement rouvert pendant le run, ignoré", {
            reportId: report.id,
          });
          continue;
        }

        // 2. Suppression des objets S3 APRÈS le commit : tant que la base n'a pas
        //    confirmé l'anonymisation, on ne détruit rien d'irrécupérable sur le
        //    bucket. Best-effort : une erreur sur un fichier ne remet pas en
        //    cause l'anonymisation, déjà actée.
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
      } catch (error) {
        if (error instanceof ReopenedDuringRunError) {
          result.skipped.push({ id: report.id });
          logger.info("Signalement refermé récemment pendant le run, ignoré", {
            reportId: report.id,
          });
          continue;
        }

        result.errors.push({ reportId: report.id, error: toMessage(error) });
        logger.error("Error deleting report", { reportId: report.id, error });
      }
    }
  }

  return result;
}
