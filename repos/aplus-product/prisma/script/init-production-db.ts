import * as fs from "fs";
import * as path from "path";
import prisma from "@/lib/prisma";
import { importAreas } from "./import-areas";
import { importOrganizations } from "./import-organizations";
import { importUsers } from "./import-users";
import { importTeams } from "./import-teams";
import { connectUsersTeams } from "./connect-users-teams";
import { importReports } from "./import-reports";
import { disconnectSource, getSourcePool } from "./source-db";
import { fixTznrTypes } from "./fix-tznr-types";
import { snapshotInactiveUsers } from "./snapshot-inactive-users";
import { cleanupInactiveTeams } from "./cleanup-inactive-teams";
import { assignTeamManagers } from "./assign-team-managers";
import { importSupervisors } from "./import-supervisors";
import { importPilotesNationaux } from "./import-pilotes-nationaux";
import { setNotifNone } from "./set-notif-none";
import { markAllAsViewed } from "./mark-all-as-viewed";
import { deleteArea } from "./delete-area";
import { importFiles } from "./import-files";
import { importFiles } from "./import-files";

const isStaging = process.argv.includes("--staging");
const skipReports = process.argv.includes("--skip-reports");

// ---------------------------------------------------------------------------
// Flags de date :
//
// --reports-since=DATE  Filtre MÉTIER : importe uniquement les signalements
//                       créés après cette date (+ leurs réponses).
//                       Users, teams et connexions sont toujours importés
//                       en totalité.
//                       Usage : limiter le volume de signalements en local/staging.
//
// --since=DATE          Filtre DELTA TECHNIQUE : importe uniquement les
//                       entités (users, teams, connexions ET signalements)
//                       créées après cette date.
//                       Usage : rattraper les données créées pendant un
//                       import complet précédent.
// ---------------------------------------------------------------------------

function parseDateArg(flagName: string): Date | undefined {
  const arg = process.argv.find((a) => a.startsWith(flagName));
  if (!arg) return undefined;
  let value = arg.includes("=")
    ? arg.split("=")[1]
    : process.argv[process.argv.indexOf(arg) + 1];
  if (!value) return undefined;
  value = value.replace(/^["']|["']$/g, "");
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    console.error(`❌ Valeur invalide pour ${flagName}: "${value}"`);
    process.exit(1);
  }
  return parsed;
}

const sinceDate = parseDateArg("--since");
const reportsSinceDate = parseDateArg("--reports-since");

// --since s'applique à tout (delta technique)
// --reports-since ne s'applique qu'aux signalements
const deltaOptions = { since: sinceDate, staging: isStaging };
const reportsOptions = {
  since: reportsSinceDate ?? sinceDate,
  staging: isStaging,
};

const LOG_DIR = path.join(__dirname, "..", "logs");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const ERROR_FILE = path.join(LOG_DIR, `errors-${timestamp}.log`);
const RECAP_FILE = path.join(LOG_DIR, `recap-${timestamp}.txt`);

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const errors: string[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stats: Record<string, any> = {};

function logStep(step: string) {
  const time = new Date().toISOString();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${time}] ${step}`);
  console.log("=".repeat(60));
}

function logSuccess(step: string, duration: number) {
  console.log(`\n✅ ${step} terminé en ${(duration / 1000).toFixed(1)}s`);
}

function logError(step: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const entry = `[${new Date().toISOString()}] ❌ ${step}\n${message}\n${stack ?? ""}\n`;

  errors.push(entry);
  console.error(`\n❌ ${step} a échoué: ${message}`);
}

interface Step {
  name: string;
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: () => Promise<any>;
}

const steps: Step[] = [
  { name: "Import des areas", key: "areas", fn: () => importAreas() },
  {
    name: "Suppression area 771f5924-7065-31c7-b464-341fc48afb05",
    key: "deleteArea",
    fn: () => deleteArea(),
  },
  {
    name: "Import des organisations",
    key: "organizations",
    fn: () => importOrganizations(),
  },
  {
    name: "Import des utilisateurs",
    key: "users",
    fn: () => importUsers(deltaOptions),
  },
  {
    name: "Import des équipes",
    key: "teams",
    fn: () => importTeams(deltaOptions),
  },
  {
    name: "Connexion utilisateurs ↔ équipes",
    key: "connections",
    fn: () => connectUsersTeams(deltaOptions),
  },
  ...(!skipReports
    ? [
        {
          name: "Import des signalements et réponses",
          key: "reports",
          fn: () => importReports(reportsOptions),
        },
        {
          name: "Import des métadonnées fichiers",
          key: "files",
          fn: () => importFiles(reportsOptions),
        },
      ]
    : []),
  {
    name: "Correction types TZNR",
    key: "tznr",
    fn: () => fixTznrTypes(),
  },
  {
    name: "Snapshot utilisateurs inactifs",
    key: "snapshot",
    fn: () => snapshotInactiveUsers(),
  },
  {
    name: "Import des superviseurs",
    key: "supervisors",
    fn: () => importSupervisors({ staging: isStaging }),
  },
  {
    name: "Import des pilotes nationaux",
    key: "pilotesNationaux",
    fn: () => importPilotesNationaux({ staging: isStaging }),
  },
  {
    name: "Assignation managers équipes orphelines",
    key: "assignManagers",
    fn: () => assignTeamManagers(),
  },
  {
    name: "Désactivation notifications managers",
    key: "notifNone",
    fn: () => setNotifNone(),
  },
  {
    name: "Marquage de tout comme consulté",
    key: "markViewed",
    fn: () => markAllAsViewed(),
  },
  {
    name: "Nettoyage équipes sans membres actifs",
    key: "cleanup",
    fn: () => cleanupInactiveTeams(),
  },
];

function pad(label: string, width = 40) {
  return label.padEnd(width);
}

interface DbTotals {
  users: number;
  activeUsers: number;
  inactiveUsers: number;
  teams: number;
  reports: number;
  answers: number;
}

interface SourceTotals {
  users: number;
  teams: number;
  reports: number;
  answers: number;
}

async function fetchDbTotals(): Promise<DbTotals> {
  const [users, activeUsers, teams, reports, answers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isInactive: null } }),
    prisma.team.count(),
    prisma.report.count(),
    prisma.answer.count(),
  ]);
  return {
    users,
    activeUsers,
    inactiveUsers: users - activeUsers,
    teams,
    reports,
    answers,
  };
}

async function fetchSourceTotals(): Promise<SourceTotals> {
  const pool = getSourcePool();
  const [users, teams, reports, answers] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM "user"`),
    pool.query(`SELECT COUNT(*)::int AS count FROM user_group`),
    pool.query(`SELECT COUNT(*)::int AS count FROM application`),
    pool.query(`SELECT COUNT(*)::int AS count FROM answer`),
  ]);
  return {
    users: users.rows[0].count,
    teams: teams.rows[0].count,
    reports: reports.rows[0].count,
    answers: answers.rows[0].count,
  };
}

function formatDelta(before: number, after: number): string {
  const diff = after - before;
  if (diff > 0) return `${after} (+${diff})`;
  if (diff < 0) return `${after} (${diff})`;
  return `${after}`;
}

function buildRecap(
  totalDuration: string,
  dbBefore: DbTotals,
  dbAfter: DbTotals,
  source: SourceTotals,
): string {
  const lines: string[] = [];
  const sep = "═".repeat(60);
  const thinSep = "─".repeat(60);

  lines.push(sep);
  lines.push("  RÉCAPITULATIF INIT-DB");
  lines.push(`  ${new Date().toISOString()}`);
  lines.push(`  Mode: ${isStaging ? "STAGING" : "PRODUCTION"}`);
  if (sinceDate)
    lines.push(`  --since (delta technique): ${sinceDate.toISOString()}`);
  if (reportsSinceDate)
    lines.push(
      `  --reports-since (filtre métier): ${reportsSinceDate.toISOString()}`,
    );
  if (skipReports) lines.push(`  Signalements: IGNORÉS (--skip-reports)`);
  lines.push(sep);

  // Areas
  if (stats.areas) {
    lines.push("");
    lines.push("  AREAS");
    lines.push(thinSep);
    lines.push(`  ${pad("Importées")} ${stats.areas.total}`);
  }

  // Organizations
  if (stats.organizations) {
    lines.push("");
    lines.push("  ORGANISATIONS");
    lines.push(thinSep);
    lines.push(`  ${pad("Importées")} ${stats.organizations.total}`);
  }

  // Users
  if (stats.users) {
    const u = stats.users;
    lines.push("");
    lines.push("  UTILISATEURS");
    lines.push(thinSep);
    lines.push(`  ${pad("Source (total)")} ${u.sourceTotal}`);
    lines.push(`  ${pad("Importés")} ${u.imported}`);
    lines.push(`  ${pad("Ignorés (invalides/désactivés)")} ${u.skipped}`);
    lines.push(`  ${pad("Marqués inactifs (>6 mois)")} ${u.inactiveCount}`);
    lines.push(`  ${pad("Actifs")} ${u.imported - u.inactiveCount}`);
  }

  // Teams
  if (stats.teams) {
    const t = stats.teams;
    lines.push("");
    lines.push("  ÉQUIPES");
    lines.push(thinSep);
    lines.push(`  ${pad("Source (total)")} ${t.sourceTotal}`);
    lines.push(`  ${pad("Importées")} ${t.imported}`);
    lines.push(`  ${pad("Ignorées à l'import (invalides)")} ${t.skipped}`);
  }

  // Connections
  if (stats.connections) {
    const c = stats.connections;
    lines.push("");
    lines.push("  CONNEXIONS UTILISATEURS ↔ ÉQUIPES");
    lines.push(thinSep);
    lines.push(`  ${pad("Utilisateurs connectés")} ${c.connected}`);
    lines.push(`  ${pad("Ignorés")} ${c.skipped}`);
    lines.push(`  ${pad("Liens utilisateur-équipe")} ${c.userTeamPairs}`);
    lines.push(`  ${pad("Liens manager-équipe")} ${c.managedTeamPairs}`);
  }

  // Reports
  if (stats.reports) {
    const r = stats.reports;
    lines.push("");
    lines.push("  SIGNALEMENTS");
    lines.push(thinSep);
    lines.push(`  ${pad("Source (total)")} ${r.sourceTotal}`);
    lines.push(`  ${pad("Importés")} ${r.reportsImported}`);
    lines.push(`  ${pad("Ignorés")} ${r.reportsSkipped}`);
    lines.push(`  ${pad("Réponses importées")} ${r.answersImported}`);
  } else if (skipReports) {
    lines.push("");
    lines.push("  SIGNALEMENTS");
    lines.push(thinSep);
    lines.push("  (ignorés via --skip-reports)");
  }

  // Snapshot
  if (stats.snapshot) {
    lines.push("");
    lines.push("  SNAPSHOT UTILISATEURS INACTIFS");
    lines.push(thinSep);
    lines.push(
      `  ${pad("Utilisateurs déconnectés de leurs équipes")} ${stats.snapshot.processed}`,
    );
  }

  // Assign managers
  if (stats.assignManagers) {
    const am = stats.assignManagers;
    lines.push("");
    lines.push("  ASSIGNATION MANAGERS ÉQUIPES ORPHELINES");
    lines.push(thinSep);
    lines.push(`  ${pad("Équipes traitées")} ${am.teamsProcessed}`);
    lines.push(`  ${pad("Managers assignés")} ${am.managersAssigned}`);
  }

  // Supervisors
  if (stats.supervisors) {
    const s = stats.supervisors;
    lines.push("");
    lines.push("  SUPERVISEURS");
    lines.push(thinSep);
    lines.push(`  ${pad("Source (total)")} ${s.total}`);
    lines.push(`  ${pad("Créés/mis à jour")} ${s.created}`);
    lines.push(`  ${pad("Ignorés")} ${s.skipped}`);
  }

  // Cleanup
  if (stats.cleanup) {
    const cl = stats.cleanup;
    const teamsImported = stats.teams?.imported ?? "?";
    const teamsActive =
      typeof teamsImported === "number" ? teamsImported - cl.total : "?";
    lines.push("");
    lines.push("  NETTOYAGE ÉQUIPES");
    lines.push(thinSep);
    lines.push(`  ${pad("Supprimées (aucun membre)")} ${cl.noMembers}`);
    lines.push(
      `  ${pad("Supprimées (membres tous inactifs)")} ${cl.noActiveMembers}`,
    );
    lines.push(`  ${pad("Total supprimées")} ${cl.total}`);
    lines.push(`  ${pad("Équipes actives restantes")} ${teamsActive}`);
  }

  // État de la base cible vs source (avec delta ce run)
  lines.push("");
  lines.push(sep);
  lines.push("  ÉTAT DE LA BASE CIBLE (ce run)        cible / source");
  lines.push(sep);
  lines.push(
    `  ${pad("Utilisateurs")} ${formatDelta(dbBefore.users, dbAfter.users)} / ${source.users}`,
  );
  lines.push(
    `  ${pad("  → actifs")} ${formatDelta(dbBefore.activeUsers, dbAfter.activeUsers)}`,
  );
  lines.push(
    `  ${pad("  → inactifs")} ${formatDelta(dbBefore.inactiveUsers, dbAfter.inactiveUsers)}`,
  );
  lines.push(
    `  ${pad("Équipes")} ${formatDelta(dbBefore.teams, dbAfter.teams)} / ${source.teams}`,
  );
  lines.push(
    `  ${pad("Signalements")} ${formatDelta(dbBefore.reports, dbAfter.reports)} / ${source.reports}`,
  );
  lines.push(
    `  ${pad("Réponses")} ${formatDelta(dbBefore.answers, dbAfter.answers)} / ${source.answers}`,
  );

  lines.push("");
  lines.push(`  ${pad("Durée totale")} ${totalDuration}s`);
  lines.push(`  ${pad("Erreurs")} ${errors.length}`);
  lines.push(sep);

  return lines.join("\n");
}

async function main() {
  const globalStart = Date.now();
  const dbTotalsBefore = await fetchDbTotals();

  console.log("🚀 Initialisation de la base de données");
  console.log(
    `   Mode: ${isStaging ? "STAGING (anonymisation inline)" : "PRODUCTION"}`,
  );
  if (sinceDate) {
    console.log(`   --since (delta technique): ${sinceDate.toISOString()}`);
    console.log(`     → users, teams, connexions et signalements filtrés`);
  }
  if (reportsSinceDate) {
    console.log(
      `   --reports-since (filtre métier): ${reportsSinceDate.toISOString()}`,
    );
    console.log(
      `     → seuls les signalements sont filtrés, users/teams importés en totalité`,
    );
  }
  if (!sinceDate && !reportsSinceDate) {
    console.log(`   Import complet (pas de filtre de date)`);
  }
  if (skipReports) {
    console.log(`   ⏭  Signalements et réponses: IGNORÉS (--skip-reports)`);
  }
  console.log(`   ${steps.length} étapes à exécuter`);
  console.log(`   Fichier d'erreurs: ${ERROR_FILE}`);
  console.log(`   Fichier récap: ${RECAP_FILE}`);

  let completed = 0;
  let failed = 0;

  for (const step of steps) {
    logStep(`[${completed + failed + 1}/${steps.length}] ${step.name}`);
    const start = Date.now();

    try {
      const result = await step.fn();
      if (result != null) {
        stats[step.key] = result;
      }
      logSuccess(step.name, Date.now() - start);
      completed++;
    } catch (error) {
      logError(step.name, error);
      failed++;
      // On continue les étapes suivantes malgré l'erreur
    }
  }

  // Résumé
  const totalDuration = ((Date.now() - globalStart) / 1000).toFixed(1);

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(60));
  console.log(`   ✅ Réussies:  ${completed}/${steps.length}`);
  console.log(`   ❌ Échouées:  ${failed}/${steps.length}`);
  console.log(`   ⏱  Durée:     ${totalDuration}s`);

  // Écriture du fichier d'erreurs
  if (errors.length > 0) {
    fs.writeFileSync(ERROR_FILE, errors.join("\n---\n\n"), "utf-8");
    console.log(
      `\n⚠️  ${errors.length} erreur(s) écrite(s) dans ${ERROR_FILE}`,
    );
  } else {
    console.log("\n🎉 Aucune erreur !");
  }

  // Compteurs réels depuis la base cible (après import) et source
  const [dbTotalsAfter, sourceTotals] = await Promise.all([
    fetchDbTotals(),
    fetchSourceTotals(),
  ]);

  // Écriture du fichier récap
  const recap = buildRecap(
    totalDuration,
    dbTotalsBefore,
    dbTotalsAfter,
    sourceTotals,
  );
  fs.writeFileSync(RECAP_FILE, recap, "utf-8");
  console.log(`\n📄 Récapitulatif écrit dans ${RECAP_FILE}`);
  console.log("\n" + recap);

  if (!sinceDate) {
    const sinceTimestamp = new Date(globalStart).toISOString();
    const stagingFlag = isStaging ? ":staging" : "";
    console.log(
      `\n💡 Pour rattraper les données créées pendant l'import (delta technique) :`,
    );
    console.log(`   bun run init-db${stagingFlag} --since="${sinceTimestamp}"`);
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("Erreur fatale:", e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectSource();
    await prisma.$disconnect();
  });
