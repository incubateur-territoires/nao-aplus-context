import prisma from "@/lib/prisma";
import {
  generateFirstName,
  generateLastName,
  generateBirthDate,
  generatePhone,
  generateNIR,
  generateCAF,
  generateNIF,
  generateSubject,
  generateDescription,
  generateAnswerContent,
} from "./anonymize-helpers";

// ============================================================================
// Types
// ============================================================================

interface AnonymizeOptions {
  dryRun: boolean;
  verbose: boolean;
  fromDate?: Date;
  toDate?: Date;
  reportIds?: string[];
}

interface AnonymizeStats {
  reportsUpdated: number;
  reportsErrors: number;
  answersUpdated: number;
  answersSkipped: number;
  answersErrors: number;
}

// ============================================================================
// Constantes
// ============================================================================

const BATCH_SIZE = 100;

// ============================================================================
// Parsing des arguments CLI
// ============================================================================

function parseArgs(): AnonymizeOptions {
  const args = process.argv.slice(2);
  const options: AnonymizeOptions = {
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--dry-run" || arg === "-d") {
      options.dryRun = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--from" && args[i + 1]) {
      options.fromDate = new Date(args[++i]);
    } else if (arg === "--to" && args[i + 1]) {
      options.toDate = new Date(args[++i]);
    } else if (arg === "--ids" && args[i + 1]) {
      options.reportIds = args[++i].split(",").map((id) => id.trim());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Usage: bun run anonymize-reports [options]

Options:
  --dry-run, -d     Prévisualiser sans modifier la base de données
  --verbose, -v     Afficher les détails de chaque modification
  --from DATE       Anonymiser les reports créés après cette date (YYYY-MM-DD)
  --to DATE         Anonymiser les reports créés avant cette date (YYYY-MM-DD)
  --ids ID1,ID2     Anonymiser uniquement les reports avec ces IDs
  --help, -h        Afficher cette aide

Exemples:
  bun run anonymize-reports --dry-run
  bun run anonymize-reports --verbose
  bun run anonymize-reports --from 2024-01-01 --to 2024-06-30
  bun run anonymize-reports --ids abc123,def456
`);
}

// ============================================================================
// Fonction principale d'anonymisation
// ============================================================================

export async function anonymizeReportsAndAnswers(
  options: AnonymizeOptions,
): Promise<AnonymizeStats> {
  const { dryRun, verbose, fromDate, toDate, reportIds } = options;

  console.log("🔒 Anonymisation des signalements et réponses...\n");

  if (dryRun) {
    console.log(
      "⚠️  Mode dry-run activé - aucune modification ne sera effectuée\n",
    );
  }

  // Construction des filtres
  const whereClause: {
    createdAt?: { gte?: Date; lte?: Date };
    id?: { in: string[] };
  } = {};

  if (fromDate || toDate) {
    whereClause.createdAt = {};
    if (fromDate) whereClause.createdAt.gte = fromDate;
    if (toDate) whereClause.createdAt.lte = toDate;
  }

  if (reportIds) {
    whereClause.id = { in: reportIds };
  }

  // Récupération du nombre total de reports
  const totalReports = await prisma.report.count({ where: whereClause });
  console.log(`   ${totalReports} signalement(s) trouvé(s)`);

  if (totalReports === 0) {
    console.log("\n   Aucun signalement à anonymiser.");
    return {
      reportsUpdated: 0,
      reportsErrors: 0,
      answersUpdated: 0,
      answersSkipped: 0,
      answersErrors: 0,
    };
  }

  const stats: AnonymizeStats = {
    reportsUpdated: 0,
    reportsErrors: 0,
    answersUpdated: 0,
    answersSkipped: 0,
    answersErrors: 0,
  };

  // Traitement par lots
  let offset = 0;

  while (offset < totalReports) {
    const reports = await prisma.report.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        phone: true,
        nir: true,
        caf: true,
        nif: true,
        subject: true,
        description: true,
        answers: {
          select: {
            id: true,
            content: true,
            isMetadataOnly: true,
          },
        },
      },
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    for (const report of reports) {
      // Génération des données anonymisées pour le report
      const anonymizedReport = {
        firstName: generateFirstName(),
        lastName: generateLastName(),
        birthDate: generateBirthDate(report.birthDate),
        phone: report.phone ? generatePhone() : null,
        nir: report.nir ? generateNIR() : null,
        caf: report.caf ? generateCAF() : null,
        nif: report.nif ? generateNIF() : null,
        subject: generateSubject(),
        description: generateDescription(),
      };

      // Préparation des answers à anonymiser (sauf isMetadataOnly)
      const answersToAnonymize = report.answers.filter(
        (a) => !a.isMetadataOnly,
      );
      const answersToSkip = report.answers.filter((a) => a.isMetadataOnly);

      if (verbose) {
        console.log(`\n  📋 Report ${report.id}:`);
        console.log(
          `     ${report.firstName} ${report.lastName} → ${anonymizedReport.firstName} ${anonymizedReport.lastName}`,
        );
        console.log(
          `     ${answersToAnonymize.length} réponse(s) à anonymiser, ${answersToSkip.length} ignorée(s)`,
        );
      }

      if (dryRun) {
        stats.reportsUpdated++;
        stats.answersUpdated += answersToAnonymize.length;
        stats.answersSkipped += answersToSkip.length;
        continue;
      }

      try {
        // Transaction pour garantir la cohérence
        await prisma.$transaction(async (tx) => {
          // Mise à jour du report
          await tx.report.update({
            where: { id: report.id },
            data: anonymizedReport,
          });

          // Mise à jour des answers (sauf metadata)
          for (const answer of answersToAnonymize) {
            await tx.answer.update({
              where: { id: answer.id },
              data: { content: generateAnswerContent() },
            });
          }
        });

        stats.reportsUpdated++;
        stats.answersUpdated += answersToAnonymize.length;
        stats.answersSkipped += answersToSkip.length;

        if (verbose) {
          console.log(`     ✓ Anonymisé avec succès`);
        }
      } catch (error) {
        stats.reportsErrors++;
        stats.answersErrors += answersToAnonymize.length;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Report ${report.id}: ${message}`);
      }
    }

    offset += BATCH_SIZE;

    // Affichage de la progression
    const progress = Math.min(offset, totalReports);
    const percentage = Math.round((progress / totalReports) * 100);
    process.stdout.write(
      `\r   Progression: ${progress}/${totalReports} (${percentage}%)`,
    );
  }

  console.log("\n");
  return stats;
}

// ============================================================================
// Point d'entrée
// ============================================================================

async function main() {
  const options = parseArgs();

  try {
    const stats = await anonymizeReportsAndAnswers(options);

    console.log(`${"=".repeat(50)}`);
    console.log(`📊 Résultats:`);
    console.log(`   ✅ ${stats.reportsUpdated} signalement(s) anonymisé(s)`);
    if (stats.reportsErrors > 0) {
      console.log(
        `   ❌ ${stats.reportsErrors} erreur(s) sur les signalements`,
      );
    }
    console.log(`   ✅ ${stats.answersUpdated} réponse(s) anonymisée(s)`);
    console.log(
      `   ⏭️  ${stats.answersSkipped} réponse(s) metadata ignorée(s)`,
    );
    if (stats.answersErrors > 0) {
      console.log(`   ❌ ${stats.answersErrors} erreur(s) sur les réponses`);
    }

    if (options.dryRun) {
      console.log(`\n⚠️  Mode dry-run - aucune modification n'a été effectuée`);
    }
  } catch (error) {
    console.error("Erreur fatale:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run standalone
if (require.main === module) {
  main();
}
