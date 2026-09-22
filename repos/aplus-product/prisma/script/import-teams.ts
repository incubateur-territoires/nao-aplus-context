import prisma from "@/lib/prisma";
import {
  fetchTeams as fetchTeamsFromSource,
  type TeamRow,
} from "./source-queries";

interface ImportOptions {
  since?: Date;
}

export async function importTeams(options?: ImportOptions) {
  console.log("\n🏠 Importing teams...");

  // Pre-load organizations by id_v1 for fast lookup
  const allOrgs = await prisma.organization.findMany({
    select: { id: true, id_v1: true, role: true, type: true },
  });
  const orgByIdV1 = new Map(allOrgs.map((o) => [o.id_v1, o]));
  console.log(`  📋 Loaded ${orgByIdV1.size} organizations`);

  // Pre-load all areas for validation
  const allAreas = await prisma.area.findMany({ select: { id: true } });
  const areaIdSet = new Set(allAreas.map((a) => a.id));
  console.log(`  📋 Loaded ${areaIdSet.size} areas`);

  const parsedRows = await fetchTeamsFromSource(options?.since);

  // Validate all rows
  const now = new Date();
  const validRows: {
    row: TeamRow;
    org: (typeof allOrgs)[0];
    existingAreaIds: string[];
  }[] = [];
  let skipped = 0;

  for (const row of parsedRows) {
    try {
      if (!row.id || !row.name) {
        console.warn(`  ⚠ Skipping invalid line (missing id or name)`);
        skipped++;
        continue;
      }

      const org = orgByIdV1.get(row.organisation);
      if (!org) {
        console.warn(
          `  ⚠ Skipping team "${row.name}": organization with id_v1 "${row.organisation}" not found`,
        );
        skipped++;
        continue;
      }

      // Filter valid areas using pre-loaded set
      const existingAreaIds = row.area_ids.filter((id) => areaIdSet.has(id));
      const missingAreas = row.area_ids.length - existingAreaIds.length;
      if (missingAreas > 0) {
        console.warn(
          `  ⚠ Team "${row.name}": ${missingAreas} area(s) not found`,
        );
      }

      validRows.push({ row, org, existingAreaIds });
    } catch (e) {
      skipped++;
      console.error(`  ✘ Parse error: ${(e as Error).message}`);
    }
  }

  console.log(`  Processing ${validRows.length} teams in batches...`);

  // Bulk upsert teams using raw SQL (1 query per chunk instead of N)
  const CHUNK_SIZE = 500;
  let imported = 0;

  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);
    const values: unknown[] = [];
    const rows: string[] = [];
    let p = 1;

    for (const { row, org } of chunk) {
      rows.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::"OrganizationRole", $${p++}, $${p++}, $${p++}::"TeamType", $${p++}::timestamp, $${p++}::timestamp, $${p++})`,
      );
      values.push(
        row.id,
        row.name,
        row.email || null,
        row.description || null,
        org.id,
        org.role,
        row.public_note || null,
        row.internal_support_comment || null,
        org.type,
        row.creation_date ?? now,
        new Date(),
        row.registration_number || null,
      );
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Team" (id, name, email, description, "organizationId", role, "publicNote", "internalSupportComment", type, "createdAt", "updatedAt", "registrationNumber")
       VALUES ${rows.join(", ")}
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         description = EXCLUDED.description,
         "organizationId" = EXCLUDED."organizationId",
         role = EXCLUDED.role,
         "publicNote" = EXCLUDED."publicNote",
         "internalSupportComment" = EXCLUDED."internalSupportComment",
         type = EXCLUDED.type,
         "updatedAt" = EXCLUDED."updatedAt",
         "registrationNumber" = EXCLUDED."registrationNumber"`,
      ...values,
    );

    imported += chunk.length;
    if (imported % 2000 < CHUNK_SIZE || imported === validRows.length) {
      console.log(`  ... ${imported}/${validRows.length} teams created`);
    }
  }

  // Bulk connect areas using raw SQL
  console.log(`  Connecting areas to teams...`);
  const teamsWithAreas = validRows.filter(
    ({ existingAreaIds }) => existingAreaIds.length > 0,
  );

  // Clear existing area connections for these teams, then bulk insert
  const teamIds = teamsWithAreas.map(({ row }) => row.id);
  if (teamIds.length > 0) {
    for (let i = 0; i < teamIds.length; i += CHUNK_SIZE) {
      const idChunk = teamIds.slice(i, i + CHUNK_SIZE);
      const placeholders = idChunk.map((_, idx) => `$${idx + 1}`).join(", ");
      await prisma.$executeRawUnsafe(
        `DELETE FROM "_AreaToTeam" WHERE "B" IN (${placeholders})`,
        ...idChunk,
      );
    }

    const allPairs: Array<{ teamId: string; areaId: string }> = [];
    for (const { row, existingAreaIds } of teamsWithAreas) {
      for (const areaId of existingAreaIds) {
        allPairs.push({ teamId: row.id, areaId });
      }
    }

    for (let i = 0; i < allPairs.length; i += CHUNK_SIZE) {
      const chunk = allPairs.slice(i, i + CHUNK_SIZE);
      const values: unknown[] = [];
      const rows: string[] = [];
      let p = 1;
      for (const pair of chunk) {
        rows.push(`($${p++}, $${p++})`);
        values.push(pair.areaId, pair.teamId);
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_AreaToTeam" ("A", "B") VALUES ${rows.join(", ")} ON CONFLICT DO NOTHING`,
        ...values,
      );
    }

    console.log(`  ... ${allPairs.length} area connections created`);
  }

  console.log(
    `\n✅ Teams imported: ${imported}/${parsedRows.length} imported, ${skipped} skipped`,
  );

  return { sourceTotal: parsedRows.length, imported, skipped };
}

// Run standalone
if (require.main === module) {
  importTeams()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error importing teams:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
