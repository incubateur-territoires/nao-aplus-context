import prisma from "@/lib/prisma";
import { fetchUsers as fetchUsersFromSource } from "./source-queries";

interface ImportOptions {
  since?: Date;
}

interface UserTeamRow {
  id: string;
  email: string;
  group_admin: boolean;
  group_ids: string[];
}

export async function connectUsersTeams(options?: ImportOptions) {
  console.log("\n🔗 Connecting users to teams...");

  // Pre-load all teams and users for validation
  const allTeams = await prisma.team.findMany({ select: { id: true } });
  const teamIdSet = new Set(allTeams.map((t) => t.id));
  console.log(`  📋 Loaded ${teamIdSet.size} teams`);

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const userIdSet = new Set(allUsers.map((u) => u.id));
  console.log(`  📋 Loaded ${userIdSet.size} users`);

  const dbRows = await fetchUsersFromSource(options?.since);
  const parsedRows: UserTeamRow[] = dbRows.map((r) => ({
    id: r.id,
    email: r.email,
    group_admin: r.group_admin,
    group_ids: r.group_ids,
  }));

  // Validate all rows
  const validRows: { row: UserTeamRow; validTeamIds: string[] }[] = [];
  let skipped = 0;

  for (const row of parsedRows) {
    try {
      if (!row.id || row.group_ids.length === 0 || !userIdSet.has(row.id)) {
        skipped++;
        continue;
      }

      // Filter valid teams using pre-loaded set
      const validTeamIds = row.group_ids.filter((id) => teamIdSet.has(id));

      if (validTeamIds.length === 0) {
        skipped++;
        continue;
      }

      validRows.push({ row, validTeamIds });
    } catch (e) {
      skipped++;
      console.error(`  ✘ Error: ${(e as Error).message}`);
    }
  }

  console.log(
    `  Processing ${validRows.length} user-team connections in batches...`,
  );

  // Build all user-team and user-managedTeam pairs
  const userTeamPairs: Array<{ userId: string; teamId: string }> = [];
  const managedTeamPairs: Array<{ userId: string; teamId: string }> = [];
  const userIdsToConnect: string[] = [];

  for (const { row, validTeamIds } of validRows) {
    userIdsToConnect.push(row.id);
    for (const teamId of validTeamIds) {
      userTeamPairs.push({ userId: row.id, teamId });
      if (row.group_admin) {
        managedTeamPairs.push({ userId: row.id, teamId });
      }
    }
  }

  // Clear existing connections for these users, then bulk insert
  const CHUNK_SIZE = 1000;

  // Clear _UserToTeam (implicit m2m: A=Team, B=User)
  for (let i = 0; i < userIdsToConnect.length; i += CHUNK_SIZE) {
    const chunk = userIdsToConnect.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(", ");
    await prisma.$executeRawUnsafe(
      `DELETE FROM "_TeamToUser" WHERE "B" IN (${placeholders})`,
      ...chunk,
    );
  }

  // Clear _TeamManager
  for (let i = 0; i < userIdsToConnect.length; i += CHUNK_SIZE) {
    const chunk = userIdsToConnect.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(", ");
    await prisma.$executeRawUnsafe(
      `DELETE FROM "_TeamManager" WHERE "B" IN (${placeholders})`,
      ...chunk,
    );
  }

  // Bulk insert user-team connections
  for (let i = 0; i < userTeamPairs.length; i += CHUNK_SIZE) {
    const chunk = userTeamPairs.slice(i, i + CHUNK_SIZE);
    const values: unknown[] = [];
    const rows: string[] = [];
    let p = 1;
    for (const pair of chunk) {
      rows.push(`($${p++}, $${p++})`);
      values.push(pair.teamId, pair.userId);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_TeamToUser" ("A", "B") VALUES ${rows.join(", ")} ON CONFLICT DO NOTHING`,
      ...values,
    );
  }

  // Bulk insert managed team connections
  for (let i = 0; i < managedTeamPairs.length; i += CHUNK_SIZE) {
    const chunk = managedTeamPairs.slice(i, i + CHUNK_SIZE);
    const values: unknown[] = [];
    const rows: string[] = [];
    let p = 1;
    for (const pair of chunk) {
      rows.push(`($${p++}, $${p++})`);
      values.push(pair.teamId, pair.userId);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_TeamManager" ("A", "B") VALUES ${rows.join(", ")} ON CONFLICT DO NOTHING`,
      ...values,
    );
  }

  const connected = validRows.length;
  console.log(`  ... ${userTeamPairs.length} user-team connections`);
  console.log(`  ... ${managedTeamPairs.length} managed-team connections`);

  console.log(
    `\n✅ Users-Teams connections: ${connected}/${parsedRows.length} connected, ${skipped} skipped`,
  );

  return {
    sourceTotal: parsedRows.length,
    connected,
    skipped,
    userTeamPairs: userTeamPairs.length,
    managedTeamPairs: managedTeamPairs.length,
  };
}

// Run standalone
if (require.main === module) {
  connectUsersTeams()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error("Error connecting users to teams:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
