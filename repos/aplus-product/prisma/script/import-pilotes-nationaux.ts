import * as fs from "fs";
import * as path from "path";
import prisma from "@/lib/prisma";

interface PiloteNationalRow {
  userId: string;
  orgShortNameList: string[];
  inseeCodes: string[];
}

function parseCsv(filePath: string): PiloteNationalRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  return lines.map((rawLine) => {
    const [userId, orgsRaw, areasRaw] = rawLine.replace(/\r$/, "").split(";");

    const orgShortNameList = orgsRaw
      ? orgsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const inseeCodes: string[] = [];
    if (areasRaw) {
      const areaParts = areasRaw.split(",").map((s) => s.trim());
      for (const part of areaParts) {
        const match = part.match(/\(([^)]+)\)$/);
        if (match) {
          inseeCodes.push(match[1]);
        }
      }
    }

    return { userId, orgShortNameList, inseeCodes };
  });
}

interface ImportOptions {
  staging?: boolean;
}

export async function importPilotesNationaux(options?: ImportOptions) {
  const staging = options?.staging ?? false;
  console.log("\n👤 Importing pilotes nationaux...");

  const csvPath = path.join(__dirname, "..", "data", "pilote_national.csv");
  const rows = parseCsv(csvPath);
  console.log(`  📋 Parsed ${rows.length} rows from CSV`);

  // Pre-load lookups
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const userIdSet = new Set(allUsers.map((u) => u.id));

  const allAreas = await prisma.area.findMany({
    select: { id: true, inseeCode: true },
  });
  const areaByInseeCode = new Map(allAreas.map((a) => [a.inseeCode, a.id]));

  const allOrgs = await prisma.organization.findMany({
    select: { id: true, shortName: true },
  });
  const orgByShortName = new Map(allOrgs.map((o) => [o.shortName, o.id]));

  console.log(
    `  📋 Loaded ${userIdSet.size} users, ${areaByInseeCode.size} areas, ${orgByShortName.size} organizations`,
  );

  // Validate rows
  const validRows: {
    userId: string;
    areaIds: string[];
    orgIds: string[];
  }[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!userIdSet.has(row.userId)) {
      console.warn(`  ⚠ User ${row.userId} introuvable, skip`);
      skipped++;
      continue;
    }

    const areaIds: string[] = [];
    for (const inseeCode of row.inseeCodes) {
      const areaId = areaByInseeCode.get(inseeCode);
      if (areaId) {
        areaIds.push(areaId);
      } else {
        console.warn(
          `  ⚠ Area avec inseeCode "${inseeCode}" introuvable pour user ${row.userId}`,
        );
      }
    }

    const orgIds: string[] = [];
    for (const shortName of row.orgShortNameList) {
      const orgId = orgByShortName.get(shortName);
      if (orgId) {
        orgIds.push(orgId);
      } else {
        console.warn(
          `  ⚠ Organisation avec shortName "${shortName}" introuvable pour user ${row.userId}`,
        );
      }
    }

    validRows.push({ userId: row.userId, areaIds, orgIds });
  }

  console.log(
    `  ${validRows.length} pilotes nationaux valides, ${skipped} ignorés`,
  );

  if (validRows.length === 0) {
    console.log("\n✅ Aucun pilote national à importer");
    return;
  }

  const userIds = validRows.map((r) => r.userId);

  // Phase 1: Disconnect from teams (raw SQL)
  console.log("  🔗 Déconnexion des équipes...");
  const CHUNK_SIZE = 1000;

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(", ");
    await prisma.$executeRawUnsafe(
      `DELETE FROM "_TeamToUser" WHERE "B" IN (${placeholders})`,
      ...chunk,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "_TeamManager" WHERE "B" IN (${placeholders})`,
      ...chunk,
    );
  }

  // Phase 2: Update role to supervisor + pseudonymize email in staging (raw SQL)
  console.log("  🔄 Mise à jour des rôles...");
  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(", ");
    if (staging) {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET role = 'supervisor', email = id || '@test.mail' WHERE id IN (${placeholders})`,
        ...chunk,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET role = 'supervisor' WHERE id IN (${placeholders})`,
        ...chunk,
      );
    }
  }

  // Phase 3: Upsert Supervisor records with relations (sequential for m2m reliability)
  console.log("  📝 Création des enregistrements Supervisor...");
  let created = 0;

  for (const row of validRows) {
    await prisma.supervisor.upsert({
      where: { userId: row.userId },
      create: {
        user: { connect: { id: row.userId } },
        areas: { connect: row.areaIds.map((id) => ({ id })) },
        organizations: { connect: row.orgIds.map((id) => ({ id })) },
      },
      update: {
        areas: { set: row.areaIds.map((id) => ({ id })) },
        organizations: { set: row.orgIds.map((id) => ({ id })) },
      },
    });
    created++;
    if (created % 5 === 0 || created === validRows.length) {
      console.log(`  ... ${created}/${validRows.length} pilotes nationaux`);
    }
  }

  console.log(
    `\n✅ Pilotes nationaux importés: ${created} créés/mis à jour, ${skipped} ignorés`,
  );

  return { total: rows.length, created, skipped };
}

// Run standalone
if (require.main === module) {
  importPilotesNationaux()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error importing pilotes nationaux:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
